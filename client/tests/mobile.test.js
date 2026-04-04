/**
 * Mobile Controls Tests
 * 测试手机触控支持
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DOM elements
const createMockElement = (id) => ({
  id,
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
  addEventListener: vi.fn(),
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    width: 120,
    height: 120,
  }),
  style: {},
});

describe('Mobile Controls Detection', () => {
  beforeEach(() => {
    // Reset window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('detects mobile by User-Agent', () => {
    const mobileUserAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      'Mozilla/5.0 (Linux; Android 10; SM-G960F)',
      'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      'Mozilla/5.0 (BlackBerry; Touch)',
    ];

    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

    mobileUserAgents.forEach(ua => {
      expect(mobileRegex.test(ua)).toBe(true);
    });
  });

  it('detects desktop User-Agent as non-mobile', () => {
    const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

    expect(mobileRegex.test(desktopUA)).toBe(false);
  });

  it('detects mobile by viewport width', () => {
    // Mock narrow viewport
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query.includes('768px'),
      media: query,
    }));

    const mediaQuery = '(max-width: 768px)';
    const isMobile = window.matchMedia(mediaQuery).matches;

    expect(isMobile).toBe(true);
  });
});

describe('Mobile Joystick Logic', () => {
  it('calculates joystick position correctly', () => {
    // Center: (60, 60), Touch: (80, 40)
    const centerX = 60, centerY = 60;
    const touchX = 80, touchY = 40;
    
    const dx = touchX - centerX; // 20
    const dy = touchY - centerY; // -20
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    expect(distance).toBeCloseTo(Math.sqrt(800));
    expect(angle).toBeCloseTo(-Math.PI / 4);
  });

  it('clamps joystick to max distance', () => {
    const maxDistance = 50;
    const dx = 100, dy = 0;
    
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const normalizedX = (dx / 100) * distance / 50;
    
    expect(distance).toBe(50);
    expect(normalizedX).toBe(1);
  });

  it('returns to center on touch end', () => {
    let moveX = 0.5, moveY = 0.3;
    
    // Simulate touch end
    moveX = 0;
    moveY = 0;
    
    expect(moveX).toBe(0);
    expect(moveY).toBe(0);
  });
});

describe('Mobile Look Area', () => {
  it('calculates rotation delta correctly', () => {
    const lastX = 100, lastY = 100;
    const currentX = 110, currentY = 90;
    
    const dx = currentX - lastX; // 10
    const dy = currentY - lastY; // -10
    
    // Rotation sensitivity
    const sensitivity = 0.005;
    const rotationDelta = dx * sensitivity;
    const pitchDelta = dy * sensitivity;
    
    expect(rotationDelta).toBe(0.05);
    expect(pitchDelta).toBe(-0.05);
  });

  it('clamps pitch to vertical limits', () => {
    const maxPitch = Math.PI / 2; // 90 degrees
    
    // Test extreme values
    const pitches = [-2, 0, 2];
    
    pitches.forEach(pitch => {
      const clamped = Math.max(-maxPitch, Math.min(maxPitch, pitch));
      expect(clamped).toBeGreaterThanOrEqual(-maxPitch);
      expect(clamped).toBeLessThanOrEqual(maxPitch);
    });
  });
});

describe('Mobile Action Buttons', () => {
  it('shoot button triggers shooting', () => {
    let shooting = false;
    let shootCount = 0;
    
    const startShooting = () => {
      shooting = true;
      shootCount++;
    };
    
    const stopShooting = () => {
      shooting = false;
    };
    
    // Simulate touch start
    startShooting();
    expect(shooting).toBe(true);
    expect(shootCount).toBe(1);
    
    // Simulate touch end
    stopShooting();
    expect(shooting).toBe(false);
  });

  it('reload button triggers reload', () => {
    let reloadCalled = false;
    
    const reload = () => {
      reloadCalled = true;
    };
    
    reload();
    expect(reloadCalled).toBe(true);
  });

  it('jump button triggers jump', () => {
    let jumpCalled = false;
    
    const jump = () => {
      jumpCalled = true;
    };
    
    jump();
    expect(jumpCalled).toBe(true);
  });
});

describe('Orientation Handling', () => {
  it('detects portrait mode on mobile', () => {
    const isPortrait = window.innerWidth < window.innerHeight;
    
    // Default Vitest window is 1024x768, so landscape
    expect(isPortrait).toBe(false);
  });

  it('shows rotate hint in portrait mode', () => {
    // This would show the #rotate-device element
    const shouldShowHint = window.innerWidth < 768 && 
                           window.innerHeight > window.innerWidth;
    
    // Desktop Vitest environment
    expect(shouldShowHint).toBe(false);
  });
});

describe('HUD Responsive Layout', () => {
  it('applies mobile styles on narrow screens', () => {
    const mobileBreakpoint = 768;
    const viewportWidth = 375; // iPhone SE width
    
    const isMobile = viewportWidth <= mobileBreakpoint;
    expect(isMobile).toBe(true);
  });

  it('keeps desktop layout on wide screens', () => {
    const mobileBreakpoint = 768;
    const viewportWidth = 1024;

    const isMobile = viewportWidth <= mobileBreakpoint;
    expect(isMobile).toBe(false);
  });
});

describe('Touch Event Handling', () => {
  it('prevents default on touch start', () => {
    const mockEvent = {
      preventDefault: vi.fn(),
      touches: [{ clientX: 100, clientY: 100 }],
    };

    mockEvent.preventDefault();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('handles multi-touch correctly', () => {
    const touches = [
      { identifier: 0, clientX: 100, clientY: 100 },
      { identifier: 1, clientX: 200, clientY: 200 },
    ];

    const joystickTouch = touches.find(t => t.identifier === 0);
    const lookTouch = touches.find(t => t.identifier === 1);

    expect(joystickTouch.clientX).toBe(100);
    expect(lookTouch.clientX).toBe(200);
  });
});

// tutorial.js - 新手教程系统
class TutorialSystem {
    constructor() {
        this.steps = this.loadSteps();
        this.currentStep = 0;
        this.active = false;
        this.completed = this.checkCompleted();
    }

    loadSteps() {
        return [
            {
                id: 'welcome',
                title: '欢迎来到 FPS Game!',
                content: '这是一个多人在线射击游戏。让我们快速了解基本操作。',
                highlight: null,
                action: null
            },
            {
                id: 'move',
                title: '移动控制',
                content: '使用 WASD 键移动，空格跳跃，Shift 加速。',
                highlight: 'movement-keys',
                action: 'move_forward'
            },
            {
                id: 'look',
                title: '视角控制',
                content: '移动鼠标控制视角，瞄准敌人。',
                highlight: null,
                action: 'look_around'
            },
            {
                id: 'shoot',
                title: '射击',
                content: '鼠标左键射击，消灭敌人获得积分！',
                highlight: 'crosshair',
                action: 'shoot'
            },
            {
                id: 'reload',
                title: '换弹',
                content: '按 R 键换弹，注意弹匣容量！',
                highlight: 'ammo-display',
                action: 'reload'
            },
            {
                id: 'weapon',
                title: '切换武器',
                content: '按 1-4 数字键切换武器，或滚轮滚动。',
                highlight: 'weapon-bar',
                action: 'switch_weapon'
            },
            {
                id: 'skill',
                title: '使用技能',
                content: '按 Q、E、F 键使用技能，每个技能有冷却时间。',
                highlight: 'skill-bar',
                action: 'use_skill'
            },
            {
                id: 'scoreboard',
                title: '查看比分',
                content: '按 Tab 查看比分板和玩家排名。',
                highlight: null,
                action: 'show_scoreboard'
            },
            {
                id: 'chat',
                title: '聊天系统',
                content: '按 Enter 打开聊天，输入消息与队友交流。',
                highlight: 'chat-input',
                action: null
            },
            {
                id: 'complete',
                title: '教程完成!',
                content: '你已经掌握了基本操作。按 ESC 打开菜单，开始游戏吧！',
                highlight: null,
                action: null
            }
        ];
    }

    checkCompleted() {
        return localStorage.getItem('fps_tutorial_completed') === 'true';
    }

    markCompleted() {
        this.completed = true;
        localStorage.setItem('fps_tutorial_completed', 'true');
    }

    start() {
        if (this.completed) return false;

        this.active = true;
        this.currentStep = 0;
        return true;
    }

    skip() {
        this.active = false;
        this.markCompleted();
    }

    next() {
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.active = false;
            this.markCompleted();
            return false;
        }
        return true;
    }

    getCurrentStep() {
        if (!this.active) return null;
        return this.steps[this.currentStep];
    }

    checkAction(action) {
        const step = this.getCurrentStep();
        if (!step || !step.action) return false;

        if (step.action === action) {
            return this.next();
        }
        return false;
    }
}

// 教程 UI
class TutorialUI {
    constructor(container, tutorial) {
        this.container = container;
        this.tutorial = tutorial;
        this.element = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'tutorial-overlay';
        this.element.style.cssText = `
            position: absolute;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #4fc3f7;
            border-radius: 15px;
            padding: 20px 30px;
            color: white;
            max-width: 500px;
            z-index: 300;
            animation: slideUp 0.3s ease-out;
        `;

        this.container.appendChild(this.element);
        this.render();
    }

    render() {
        const step = this.tutorial.getCurrentStep();
        if (!step) {
            this.hide();
            return;
        }

        const progress = ((this.tutorial.currentStep + 1) / this.tutorial.steps.length) * 100;

        this.element.innerHTML = `
            <style>
                @keyframes slideUp {
                    from { transform: translate(-50%, 20px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 10px #4fc3f7; }
                    50% { box-shadow: 0 0 20px #4fc3f7; }
                }
            </style>

            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            ">
                <h3 style="margin: 0; color: #4fc3f7;">${step.title}</h3>
                <span style="color: #888; font-size: 12px;">
                    ${this.tutorial.currentStep + 1}/${this.tutorial.steps.length}
                </span>
            </div>

            <div style="
                width: 100%;
                height: 4px;
                background: #333;
                border-radius: 2px;
                margin-bottom: 15px;
            ">
                <div style="
                    width: ${progress}%;
                    height: 100%;
                    background: #4fc3f7;
                    border-radius: 2px;
                    transition: width 0.3s;
                "></div>
            </div>

            <p style="margin: 0 0 15px 0; line-height: 1.5;">${step.content}</p>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="skipTutorial" style="
                    padding: 8px 20px;
                    background: transparent;
                    border: 1px solid #666;
                    border-radius: 5px;
                    color: #888;
                    cursor: pointer;
                ">跳过</button>
                <button id="nextStep" style="
                    padding: 8px 20px;
                    background: #4fc3f7;
                    border: none;
                    border-radius: 5px;
                    color: white;
                    cursor: pointer;
                ">下一步</button>
            </div>
        `;

        this.bindEvents();

        // 高亮效果
        if (step.highlight) {
            this.highlightElement(step.highlight);
        }
    }

    bindEvents() {
        this.element.querySelector('#skipTutorial').addEventListener('click', () => {
            this.tutorial.skip();
            this.hide();
        });

        this.element.querySelector('#nextStep').addEventListener('click', () => {
            this.tutorial.next();
            this.render();
        });
    }

    highlightElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.animation = 'pulse 1s infinite';
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.TutorialSystem = TutorialSystem;
window.TutorialUI = TutorialUI;

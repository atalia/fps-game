// Player module - Local player control
class PlayerController {
    constructor() {
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = 0;
        this.pitch = 0;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.speed = 0.15;
        this.jumpForce = 0.3;
        this.gravity = -0.02;
        this.onGround = true;

        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };

        this.mouse = {
            sensitivity: 0.002,
            locked: false
        };

        this.health = 100;
        this.ammo = 30;
        this.ammoReserve = 90;
        this.kills = 0;
        this.deaths = 0;
        this.score = 0;

        this.canShoot = true;
        this.shootCooldown = 100; // ms

        this.init();
    }

    init() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Mouse events
        document.addEventListener('click', () => this.requestPointerLock());
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    }

    requestPointerLock() {
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen.style.display !== 'none') {
            gameScreen.requestPointerLock();
        }
    }

    onPointerLockChange() {
        this.mouse.locked = document.pointerLockElement !== null;
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'Tab':
                e.preventDefault();
                window.game?.toggleScoreboard(true);
                break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'Tab':
                window.game?.toggleScoreboard(false);
                break;
        }
    }

    onMouseMove(e) {
        if (!this.mouse.locked) return;

        this.rotation -= e.movementX * this.mouse.sensitivity;
        this.pitch -= e.movementY * this.mouse.sensitivity;

        // Clamp pitch
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
    }

    onMouseDown(e) {
        if (!this.mouse.locked) return;

        if (e.button === 0) { // Left click - shoot
            this.shoot();
        }
    }

    update() {
        // Movement
        const moveDirection = { x: 0, z: 0 };

        if (this.keys.forward) {
            moveDirection.x += Math.sin(this.rotation);
            moveDirection.z += Math.cos(this.rotation);
        }
        if (this.keys.backward) {
            moveDirection.x -= Math.sin(this.rotation);
            moveDirection.z -= Math.cos(this.rotation);
        }
        if (this.keys.left) {
            moveDirection.x += Math.cos(this.rotation);
            moveDirection.z -= Math.sin(this.rotation);
        }
        if (this.keys.right) {
            moveDirection.x -= Math.cos(this.rotation);
            moveDirection.z += Math.sin(this.rotation);
        }

        // Normalize
        const length = Math.sqrt(moveDirection.x ** 2 + moveDirection.z ** 2);
        if (length > 0) {
            moveDirection.x /= length;
            moveDirection.z /= length;
        }

        // Apply movement
        this.position.x += moveDirection.x * this.speed;
        this.position.z += moveDirection.z * this.speed;

        // Jump and gravity
        if (this.keys.jump && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

        this.velocity.y += this.gravity;
        this.position.y += this.velocity.y;

        // Ground check
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.onGround = true;
        }

        // Boundary check
        const boundary = 48;
        this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x));
        this.position.z = Math.max(-boundary, Math.min(boundary, this.position.z));

        return {
            position: { ...this.position },
            rotation: this.rotation
        };
    }

    shoot() {
        if (!this.canShoot || this.ammo <= 0) return;

        this.ammo--;
        this.canShoot = false;
        this.updateHUD();

        // Send shoot event
        window.network.send('shoot', {
            position: this.position,
            rotation: this.rotation
        });

        // Cooldown
        setTimeout(() => {
            this.canShoot = true;
        }, this.shootCooldown);
    }

    reload() {
        const needed = 30 - this.ammo;
        if (needed <= 0 || this.ammoReserve <= 0) return;

        const toReload = Math.min(needed, this.ammoReserve);
        this.ammo += toReload;
        this.ammoReserve -= toReload;
        this.updateHUD();
    }

    takeDamage(damage) {
        this.health -= damage;
        this.updateHUD();

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.deaths++;
        this.health = 0;
        this.updateHUD();

        // Respawn after 3 seconds
        setTimeout(() => this.respawn(), 3000);
    }

    respawn() {
        this.health = 100;
        this.ammo = 30;
        this.position = {
            x: (Math.random() - 0.5) * 40,
            y: 0,
            z: (Math.random() - 0.5) * 40
        };
        this.updateHUD();
    }

    addKill() {
        this.kills++;
        this.score += 100;
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('health-fill').style.width = `${this.health}%`;
        document.getElementById('ammo').textContent = this.ammo;
        document.getElementById('ammo-reserve').textContent = this.ammoReserve;
        document.getElementById('score').textContent = this.score;
        document.getElementById('kills').textContent = this.kills;
    }
}

window.PlayerController = PlayerController;

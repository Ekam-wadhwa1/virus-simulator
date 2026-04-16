export class Person {
    constructor(x, y, initialState, params, boundX, boundY) {
        this.x = x;
        this.y = y;
        this.boundX = boundX;
        this.boundY = boundY;
        
        this.state = initialState; // 'susceptible', 'infected', 'recovered', 'vaccinated', 'dead'
        this.radius = 3;
        
        // Velocity
        this.vx = 0;
        this.vy = 0;
        
        this.infectionTimer = 0;
        this.recoveryTime = 10 + Math.random() * 8; // Simulate 10-18 days recovery
        
        this.vaccineEfficacy = initialState === 'vaccinated' ? params.vaccineEff : 0;
        
        // Personal anchor for somewhat localized movement (not totally random gas)
        this.anchorX = x;
        this.anchorY = y;
        this.anchorStrength = 0.05 + Math.random() * 0.1;
        
        this.updateBehavior(params);
        this.randomizeVelocity();
    }
    
    setBoundaries(w, h) {
        this.boundX = w;
        this.boundY = h;
    }
    
    updateBehavior(params) {
        // Map UI sliders to literal behavior
        this.movementSpeedConf = params.movement; // 1-10
        this.lockdownConf = params.lockdown; // 0-10
        this.socialInteraction = params.social; // 1-10
        
        this.calculateEffectiveSpeed();
    }
    
    calculateEffectiveSpeed() {
        // Base speed
        let speed = this.movementSpeedConf * 15; // 15 to 150 px/sec
        
        // Lockdown drastically curtails speed
        let lockdownMultiplier = 1 - (this.lockdownConf / 10) * 0.9;
        
        // Social interaction increases wandering distance (less anchor strength)
        this.anchorStrength = 0.2 - (this.socialInteraction / 10) * 0.15; // 0.05 to 0.2
        
        this.currentSpeed = speed * lockdownMultiplier;
        
        // Restricting speed to near zero if lockdown is max
        if (this.currentSpeed < 5) this.currentSpeed = 5; 
        
        // When sick, move slower
        if (this.state === 'infected' || this.state === 'dead') {
            this.currentSpeed *= 0.2;
        }
        
        this.randomizeVelocity();
    }
    
    randomizeVelocity() {
        if (this.state === 'dead') {
            this.vx = 0;
            this.vy = 0;
            return;
        }
        
        let angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * this.currentSpeed;
        this.vy = Math.sin(angle) * this.currentSpeed;
    }
    
    vaccinate(efficacy) {
        this.state = 'vaccinated';
        this.vaccineEfficacy = efficacy;
    }
    
    infect() {
        this.state = 'infected';
        this.infectionTimer = 0;
        this.calculateEffectiveSpeed(); // Slow down
    }
    
    update(dt) {
        if (this.state === 'dead') return;
        
        // Smoothly pull back to anchor to form "communities" rather than uniform gas
        let ax = (this.anchorX - this.x) * this.anchorStrength;
        let ay = (this.anchorY - this.y) * this.anchorStrength;
        
        // Add random jitter based on social interaction
        let jitter = this.socialInteraction * 5;
        this.vx += (Math.random() - 0.5) * jitter;
        this.vy += (Math.random() - 0.5) * jitter;
        
        // Normalize speed
        let currentMag = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (currentMag > 0) {
            this.vx = (this.vx / currentMag) * this.currentSpeed;
            this.vy = (this.vy / currentMag) * this.currentSpeed;
        }

        // Apply anchor pull gently
        this.x += (this.vx + ax) * dt;
        this.y += (this.vy + ay) * dt;
        
        // Boundaries bounce
        if (this.x < 0) { this.x = 0; this.vx *= -1; }
        if (this.x > this.boundX) { this.x = this.boundX; this.vx *= -1; }
        if (this.y < 0) { this.y = 0; this.vy *= -1; }
        if (this.y > this.boundY) { this.y = this.boundY; this.vy *= -1; }
        
        // Infection logic
        if (this.state === 'infected') {
            this.infectionTimer += dt;
            if (this.infectionTimer >= this.recoveryTime) {
                // Roll for death based on flat % or base immunity
                // Base 2% death rate, mitigated by base immunity slightly
                if (Math.random() < 0.02) {
                    this.state = 'dead';
                    this.calculateEffectiveSpeed();
                } else {
                    this.state = 'recovered';
                    this.calculateEffectiveSpeed(); // Speeds backup
                }
            }
        }
    }
}

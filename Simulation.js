import { Person } from './Person.js';

export class Simulation {
    constructor(params, insightSystem) {
        // Fixed internal logical bounds to mathematically preserve population density!
        this.width = 1500;
        this.height = 1500;
        
        this.params = params;
        this.insightSystem = insightSystem;
        
        this.persons = [];
        this.timeElapsed = 0; // Simulated days
        this.tickCount = 0;
        
        // Panning Offsets & Zoom
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoom = 1.0;
        this.centeredInitially = false;
        
        this.baseInfectionRadius = 15; // Spatial threshold for collision/transmission
        this.rValueTracking = []; // Track recent infections to estimate R value
        this.newInfectionsInWindow = 0;
        
        this.init();
    }
    
    init() {
        this.persons = [];
        // Apply initial vaccination
        const vaccCount = Math.floor(this.params.population * (this.params.vaccination / 100));
        
        for (let i = 0; i < this.params.population; i++) {
            let isVaccinated = i < vaccCount;
            // 1% initial infection, but minimum 1 person
            let isInfected = (i >= vaccCount && i < vaccCount + Math.max(1, this.params.population * 0.01));
            
            let state = isInfected ? 'infected' : (isVaccinated ? 'vaccinated' : 'susceptible');
            
            this.persons.push(new Person(
                Math.random() * this.width,
                Math.random() * this.height,
                state,
                this.params,
                this.width,
                this.height
            ));
        }
    }
    
    // Stub out resize because we now want an infinite scaled map approach 
    // where density doesn't change when screen size changes!
    resize(width, height) {
        // No-op: bounds are permanently fixed so scientific logic is not violated by users resizing browser screens.
    }
    
    updateParams(newParams) {
        let oldVaccination = this.params.vaccination;
        this.params = newParams;
        
        // Update person behaviors
        this.persons.forEach(p => p.updateBehavior(this.params));
        
        // Handle massive vaccination rollout mid-simulation
        if (newParams.vaccination > oldVaccination) {
            let targetVaccinated = Math.floor(this.params.population * (this.params.vaccination / 100));
            let currentVaccinated = this.persons.filter(p => !!p.vaccineEfficacy).length; // Check actual efficacy instead of state, as they could be in Susceptible state initially
            let toVaccinate = targetVaccinated - currentVaccinated;
            
            if (toVaccinate > 0) {
                // Find susceptibles
                let susceptibles = this.persons.filter(p => p.state === 'susceptible');
                // Shuffle manually
                for(let i = susceptibles.length - 1; i > 0; i--){
                    const j = Math.floor(Math.random() * (i + 1));
                    [susceptibles[i], susceptibles[j]] = [susceptibles[j], susceptibles[i]];
                }
                
                let count = 0;
                for (let p of susceptibles) {
                    if (count >= toVaccinate) break;
                    p.vaccinate(this.params.vaccineEff);
                    count++;
                }
                if (count > 0 && this.insightSystem) {
                    this.insightSystem.log(`Vaccination rollout: ${count} individuals vaccinated.`, "positive");
                }
            }
        }
    }
    
    update(dt) {
        // dt is roughly fractions of a "day" depending on speed multiplier
        // Scale dt so 1 second real time = 1 simulation day (at 1x speed)
        const simDt = dt; 
        this.timeElapsed += simDt;
        this.tickCount++;
        
        // QuadTree or spatial hash would be better for high population,
        // Using optimized naive for <10000, but let's implement basic grid partitioning for performance
        const gridSize = this.baseInfectionRadius * 2;
        const grid = new Map();
        
        // 1. Move persons and build spatial grid
        for (let p of this.persons) {
            p.update(simDt);
            
            if (p.state !== 'dead') {
                const cx = Math.floor(p.x / gridSize);
                const cy = Math.floor(p.y / gridSize);
                const key = `${cx},${cy}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(p);
            }
        }
        
        // 2. Interaction Phase
        // Parameters mapping to equation: dI/dt = βSI − γI
        // β (beta) is effective contact rate * transmission probability
        
        // Calculate Base Transmission Probability
        let baseBeta = 0.05; // Base probability per contact tick
        
        // Modifiers
        // Hygiene reduces contact probability
        let hygieneModifier = 1 - (this.params.hygiene - 1) * 0.05; // 1 to 0.55
        // Awareness boosts hygiene
        let awarenessModifier = 1 - (this.params.awareness - 1) * 0.02; 
        
        let finalTransProb = baseBeta * hygieneModifier * awarenessModifier;
        
        // Mutation increases it randomly
        if (Math.random() < (this.params.mutation / 1000)) {
            finalTransProb *= 1.5; // Mutated burst
        }

        let infectionsThisTick = 0;

        for (let p of this.persons) {
            if (p.state !== 'infected') continue;
            
            // Check neighbors
            const cx = Math.floor(p.x / gridSize);
            const cy = Math.floor(p.y / gridSize);
            
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const neighborKey = `${cx+ox},${cy+oy}`;
                    const neighbors = grid.get(neighborKey);
                    if (!neighbors) continue;
                    
                    for (let other of neighbors) {
                        if (other === p || (other.state !== 'susceptible' && other.state !== 'vaccinated')) continue;
                        
                        // Check distance
                        const dx = p.x - other.x;
                        const dy = p.y - other.y;
                        const distSq = dx*dx + dy*dy;
                        
                        if (distSq < this.baseInfectionRadius * this.baseInfectionRadius) {
                            // Contact! Roll for infection
                            
                            // Other's immunity check
                            let defense = (this.params.immunity / 10) * 0.3; // Base immunity 0-30% reduction
                            if (other.state === 'vaccinated') {
                                defense += (other.vaccineEfficacy / 100) * 0.9; // Up to 90%
                            }
                            
                            let actualTransProb = finalTransProb * (1 - Math.min(0.99, defense));
                            
                            if (Math.random() < actualTransProb) {
                                other.infect();
                                infectionsThisTick++;
                            }
                        }
                    }
                }
            }
        }
        
        this.newInfectionsInWindow += infectionsThisTick;
        
        // Every 1 day evaluate R0 Approx
        if (this.timeElapsed >= this.rValueTracking.length + 1) {
            let currentInfected = this.persons.filter(p => p.state === 'infected').length;
            // Rough R tracking: Infections caused recently / (Infected Population * Recovery Time Rate)
            // Simplified approximation for dashboard display
            let approxRecoveryTime = 14; 
            let approxR = currentInfected > 0 ? (this.newInfectionsInWindow * approxRecoveryTime) / currentInfected : 0;
            this.rValueTracking.push(approxR);
            this.newInfectionsInWindow = 0;
        }
    }

    setOffset(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
    }
    
    applyZoom(factor, cursorX, cursorY) {
        // Prevent scaling from going microscopic or infinitely massive
        if (this.zoom * factor < 0.1 || this.zoom * factor > 10.0) {
            return; 
        }
        
        // Translate screen cursor point to local logical coordinates (before zoom shift)
        const logicalX = (cursorX - this.offsetX) / this.zoom;
        const logicalY = (cursorY - this.offsetY) / this.zoom;
        
        // Scale the zoom
        this.zoom *= factor;
        
        // Re-align the offset so the logical point matches the cursor on screen
        this.offsetX = cursorX - logicalX * this.zoom;
        this.offsetY = cursorY - logicalY * this.zoom;
    }
    
    draw(ctx, canvasWidth, canvasHeight) {
        if (!this.centeredInitially) {
            // Smart auto-fit algorithm to fit the 1500x1500 logical map cleanly to the user's viewport on start
            const scaleX = canvasWidth / this.width;
            const scaleY = canvasHeight / this.height;
            this.zoom = Math.min(scaleX, scaleY) * 0.90; // Fit generously inside
            
            this.offsetX = (canvasWidth - this.width * this.zoom) / 2;
            this.offsetY = (canvasHeight - this.height * this.zoom) / 2;
            this.centeredInitially = true;
        }

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.zoom, this.zoom);
        
        // Draw the simulation container boundaries to orient the user visually when panning
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 4 / this.zoom; // Keep logical thickness visually identical
        ctx.strokeRect(0, 0, this.width, this.height);
        
        // Optimization: Batch drawing by color state
        const stateColors = {
            'susceptible': '#30D158',
            'infected': '#FF453A',
            'recovered': '#FFD60A',
            'vaccinated': '#64D2FF',
            'dead': '#8E8E93'
        };
        
        const groups = {
            'susceptible': [],
            'infected': [],
            'recovered': [],
            'vaccinated': [],
            'dead': []
        };
        
        for (let p of this.persons) {
            groups[p.state].push(p);
        }
        
        for (let state in groups) {
            if (groups[state].length === 0) continue;
            
            ctx.fillStyle = stateColors[state];
            ctx.beginPath();
            
            for (let p of groups[state]) {
                ctx.moveTo(p.x, p.y);
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            }
            
            // Draw regular dots first
            ctx.fill();
        }

        // Draw explicit heatmap overlay for infected to make it look "bigger" and more intense
        if (groups['infected'].length > 0) {
            ctx.beginPath();
            groups['infected'].forEach(p => {
                ctx.moveTo(p.x, p.y);
                ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2); 
            });
            ctx.fillStyle = 'rgba(255, 69, 58, 0.4)'; // Larger semi-transparent red aura
            ctx.shadowBlur = 35; // Massively increase blur
            ctx.shadowColor = stateColors['infected'];
            ctx.fill();
            
            ctx.shadowBlur = 0; // reset
        }
        
        ctx.restore();
    }
    
    getStats() {
        let stats = {
            susceptible: 0,
            infected: 0,
            recovered: 0,
            vaccinated: 0,
            dead: 0,
            rValue: this.rValueTracking.length > 0 ? this.rValueTracking[this.rValueTracking.length - 1] : 0
        };
        
        for (let p of this.persons) {
            stats[p.state]++;
        }
        return stats;
    }
}

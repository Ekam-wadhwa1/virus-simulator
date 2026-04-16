export class InsightSystem {
    constructor(containerElement) {
        this.container = containerElement;
        this.flags = {
            peakDetected: false,
            highTransmissibility: false,
            highRecovery: false,
            lockdownEffective: false,
        };
        this.previousInfected = 0;
        this.infectedHistory = [];
    }
    
    clear() {
        this.container.innerHTML = '';
        this.flags = { peakDetected: false, highTransmissibility: false, highRecovery: false, lockdownEffective: false };
        this.previousInfected = 0;
        this.infectedHistory = [];
        this.log("Simulation initialized. Awaiting start command.", "normal", 0);
    }
    
    formatTime(days) {
        return `Day ${Math.floor(days)}`;
    }
    
    log(message, type = "normal", timeElapsed = 0) {
        const entry = document.createElement('div');
        entry.className = `insight-entry ${type}`;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.innerText = `[${this.formatTime(timeElapsed)}]`;
        
        const text = document.createElement('p');
        text.innerText = message;
        
        entry.appendChild(timeSpan);
        entry.appendChild(text);
        
        this.container.insertBefore(entry, this.container.firstChild);
        
        // Keep max 20 entries
        if (this.container.children.length > 20) {
            this.container.removeChild(this.container.lastChild);
        }
    }
    
    checkStatus(stats, timeElapsed) {
        // Collect history
        this.infectedHistory.push(stats.infected);
        if (this.infectedHistory.length > 30) this.infectedHistory.shift(); // ~3 days of history @ 10 ticks/day

        // Insight: Rapid Infection
        if (stats.rValue > 2.5 && !this.flags.highTransmissibility && stats.infected > 50) {
            this.flags.highTransmissibility = true;
            this.log("Spike detected: Infection rate increased rapidly. High R-Value indicates strong community transmission.", "warning", timeElapsed);
        }
        
        // Insight: Peak Detected
        if (this.infectedHistory.length === 30 && !this.flags.peakDetected && stats.infected > 100) {
            let maxInfected = Math.max(...this.infectedHistory);
            if (stats.infected < maxInfected * 0.9 && stats.rValue < 1.0) {
                this.flags.peakDetected = true;
                this.log("Peak infection likely passed. The curve is flattening as recoveries outpace new infections.", "positive", timeElapsed);
            }
        }
        
        // Insight: Lockdown efficacy
        if (stats.rValue < 0.8 && stats.infected > 20 && !this.flags.lockdownEffective) {
            this.flags.lockdownEffective = true;
            this.log("Containment effective: Social distancing / lockdown is successfully reducing the transmission coefficient below 1.", "positive", timeElapsed);
        }
        
        this.previousInfected = stats.infected;
    }
}

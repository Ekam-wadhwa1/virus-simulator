import { Simulation } from './Simulation.js';
import { ChartManager } from './ChartManager.js';
import { InsightSystem } from './InsightSystem.js';

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const elements = {
        canvas: document.getElementById('simCanvas'),
        btnPauseResume: document.getElementById('btnPauseResume'),
        btnStep: document.getElementById('btnStep'),
        btnReset: document.getElementById('btnReset'),
        btnCredits: document.getElementById('btnCredits'),
        btnFullscreen: document.getElementById('btnFullscreen'),
        speedControl: document.getElementById('speedControl'),
        
        // Stats
        statRValue: document.getElementById('statRValue'),
        statActive: document.getElementById('statActive'),
        countSusceptible: document.getElementById('countSusceptible'),
        countInfected: document.getElementById('countInfected'),
        countRecovered: document.getElementById('countRecovered'),
        countVaccinated: document.getElementById('countVaccinated'),
        countDead: document.getElementById('countDead'),
        
        // Sliders & Values
        sliders: {
            population: document.getElementById('populationCount'),
            immunity: document.getElementById('immunityLevel'),
            hygiene: document.getElementById('hygieneLevel'),
            social: document.getElementById('socialInteraction'),
            movement: document.getElementById('movementSpeed'),
            vaccination: document.getElementById('vaccinationRate'),
            vaccineEff: document.getElementById('vaccineEff'),
            lockdown: document.getElementById('lockdownIntensity'),
            awareness: document.getElementById('awarenessLevel'),
            mutation: document.getElementById('mutationChance')
        },
        displays: {
            population: document.getElementById('valPopulation'),
            immunity: document.getElementById('valImmunity'),
            hygiene: document.getElementById('valHygiene'),
            social: document.getElementById('valSocial'),
            movement: document.getElementById('valMovement'),
            vaccination: document.getElementById('valVaccination'),
            vaccineEff: document.getElementById('valVaccineEff'),
            lockdown: document.getElementById('valLockdown'),
            awareness: document.getElementById('valAwareness'),
            mutation: document.getElementById('valMutation')
        }
    };

    // Subsystems
    const insightSystem = new InsightSystem(document.getElementById('insightsLog'));
    const chartManager = new ChartManager(document.getElementById('sirChart').getContext('2d'));
    
    // Resize Canvas to fit container
    function resizeCanvas() {
        const container = elements.canvas.parentElement;
        elements.canvas.width = container.clientWidth;
        elements.canvas.height = container.clientHeight;
    }
    window.addEventListener('resize', () => {
        resizeCanvas();
        if (simulation) {
            // Re-draw immediately if paused so screen doesn't go black from wipe
            if (!isRunning) {
                requestAnimationFrame(() => simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height));
            }
        }
    });
    
    // Specifically handle the browser shifting into fullscreen
    document.addEventListener('fullscreenchange', () => {
        // Slight delay ensures the browser's DOM fully painted the new resolution
        setTimeout(() => {
            resizeCanvas();
            if (simulation && !isRunning) {
                simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
            }
        }, 100);
    });
    
    resizeCanvas();

    // Init Simulation (Logical fixed-size density is managed inside)
    let simulation = new Simulation(getParams(), insightSystem);
    
    // Sync UI with Slider updates
    function syncValueDisplay() {
        Object.keys(elements.sliders).forEach(key => {
            elements.sliders[key].addEventListener('input', (e) => {
                elements.displays[key].innerText = e.target.value;
                if(key === 'population') {
                    // Update population requires partial reset or dynamic add/remove, keeping it simple: trigger a gentle re-evaluation
                } else {
                    simulation.updateParams(getParams());
                }
            });
            // Reset full sim if population changes on mouse up
            if (key === 'population') {
                elements.sliders[key].addEventListener('change', () => {
                   resetSimulation();
                });
            }
        });
    }

    function getParams() {
        return {
            population: parseInt(elements.sliders.population.value),
            immunity: parseInt(elements.sliders.immunity.value),
            hygiene: parseInt(elements.sliders.hygiene.value),
            social: parseInt(elements.sliders.social.value),
            movement: parseInt(elements.sliders.movement.value),
            vaccination: parseInt(elements.sliders.vaccination.value),
            vaccineEff: parseInt(elements.sliders.vaccineEff.value),
            lockdown: parseInt(elements.sliders.lockdown.value),
            awareness: parseInt(elements.sliders.awareness.value),
            mutation: parseInt(elements.sliders.mutation.value)
        };
    }

    // Main Loop
    let animationId;
    let isRunning = false;
    let speedMultiplier = 1;
    let lastTime = 0;

    function mainLoop(time) {
        if (!isRunning) return;
        
        const dt = (time - lastTime) * speedMultiplier;
        lastTime = time;

        if (dt > 0 && dt < 200) { // Limit dt to prevent huge jumps if tab inactive
            simulation.update(dt/1000); 
            simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
            updateLogistics();
            insightSystem.checkStatus(simulation.getStats(), simulation.timeElapsed);
        }
        
        animationId = requestAnimationFrame(mainLoop);
    }

    function updateLogistics() {
        const stats = simulation.getStats();
        
        elements.countSusceptible.innerText = stats.susceptible;
        elements.countInfected.innerText = stats.infected;
        elements.countRecovered.innerText = stats.recovered;
        elements.countVaccinated.innerText = stats.vaccinated;
        elements.countDead.innerText = stats.dead;

        elements.statActive.innerText = stats.infected;
        elements.statRValue.innerText = stats.rValue.toFixed(2);

        // Update Chart every few frames (e.g. roughly every 0.1 simulation days)
        if (simulation.tickCount % 10 === 0) {
            chartManager.updateChart(simulation.timeElapsed, stats);
        }
    }

    function toggleSimulation() {
        isRunning = !isRunning;
        elements.btnPauseResume.innerText = isRunning ? "Pause" : "Start";
        if (isRunning) {
            lastTime = performance.now();
            requestAnimationFrame(mainLoop);
            insightSystem.log("Simulation resumed.", "normal");
        } else {
            cancelAnimationFrame(animationId);
            insightSystem.log("Simulation paused.", "normal");
        }
    }

    function resetSimulation() {
        cancelAnimationFrame(animationId);
        isRunning = false;
        elements.btnPauseResume.innerText = "Start";
        
        simulation = new Simulation(getParams(), insightSystem);
        chartManager.reset();
        insightSystem.clear();
        insightSystem.log("Simulation reset parameters.", "normal");
        
        simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
        updateLogistics();
    }

    function stepSimulation() {
        if (isRunning) toggleSimulation();
        simulation.update(1/60); // 1 frame
        simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
        updateLogistics();
    }

    // Event Listeners
    elements.btnPauseResume.addEventListener('click', toggleSimulation);
    elements.btnReset.addEventListener('click', resetSimulation);
    elements.btnStep.addEventListener('click', stepSimulation);
    elements.speedControl.addEventListener('change', (e) => {
        speedMultiplier = parseFloat(e.target.value);
    });

    // Fullscreen Map Logic with Cross-Browser Compliance
    elements.btnFullscreen.addEventListener('click', () => {
        const container = elements.canvas.parentElement;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        
        if (!isFullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen().catch(err => console.error(err));
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });

    // Map Panning & Zoom Logic (Multi-button support)
    let isDraggingMap = false;
    let startPanX = 0;
    let startPanY = 0;

    elements.canvas.addEventListener('contextmenu', e => e.preventDefault()); // Prevent normal right-click menu

    elements.canvas.addEventListener('mousedown', e => {
        // Removed e.button === 2 restriction: ANY click (Left/Right) will pan the map
        isDraggingMap = true;
        startPanX = e.clientX;
        startPanY = e.clientY;
        elements.canvas.style.cursor = 'grabbing';
        elements.canvas.parentElement.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        if (isDraggingMap) {
            const dx = e.clientX - startPanX;
            const dy = e.clientY - startPanY;
            simulation.setOffset(dx, dy);
            startPanX = e.clientX;
            startPanY = e.clientY;
            
            // Re-draw immediately to avoid flickering lag when paused
            if (!isRunning) {
                simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
            }
        }
    });

    window.addEventListener('mouseup', e => {
        isDraggingMap = false;
        elements.canvas.style.cursor = 'default';
        elements.canvas.parentElement.style.cursor = 'default';
    });
    
    // Scroll Wheel to Zoom
    elements.canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = elements.canvas.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        
        const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
        simulation.applyZoom(zoomDelta, cursorX, cursorY);
        
        if (!isRunning) {
            simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
        }
    }, {passive: false});

    // Credits Modal Logic
    const modal = document.getElementById('creditsModal');
    const closeCredits = document.getElementById('closeCredits');
    const creditsContainer = document.getElementById('creditsContainer');

    elements.btnCredits.addEventListener('click', () => {
        modal.classList.remove('hidden');
        loadCredits();
    });

    closeCredits.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    async function loadCredits() {
        try {
            const response = await fetch('credits.json');
            const data = await response.json();
            creditsContainer.innerHTML = ''; // clear loading text
            
            data.forEach(item => {
                const creditDiv = document.createElement('div');
                creditDiv.className = 'credit-item';
                
                const roleSpan = document.createElement('span');
                roleSpan.className = 'credit-role';
                roleSpan.innerText = item.role;
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'credit-name';
                nameSpan.innerText = item.name;
                
                creditDiv.appendChild(roleSpan);
                creditDiv.appendChild(nameSpan);
                creditsContainer.appendChild(creditDiv);
            });
        } catch (error) {
            creditsContainer.innerHTML = '<span class="loading-text">Error loading credits.</span>';
            console.error('Failed to load credits.json', error);
        }
    }

    syncValueDisplay();
    
    // Initial draw
    simulation.draw(elements.canvas.getContext('2d'), elements.canvas.width, elements.canvas.height);
    updateLogistics();
});

export class ChartManager {
    constructor(ctx) {
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Infected',
                        data: [],
                        borderColor: '#FF453A',
                        backgroundColor: 'rgba(255, 69, 58, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 2
                    },
                    {
                        label: 'Recovered',
                        data: [],
                        borderColor: '#FFD60A',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 2
                    },
                    {
                        label: 'Susceptible',
                        data: [],
                        borderColor: '#30D158',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: { color: '#f0f0f5', font: { family: 'Inter' } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Days', color: '#9e9ea5' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#9e9ea5', maxTicksLimit: 10 }
                    },
                    y: {
                        stacked: false,
                        title: { display: true, text: 'Population', color: '#9e9ea5' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#9e9ea5' }
                    }
                }
            }
        });
    }

    updateChart(time, stats) {
        // Floor time to 1 decimal place to prevent label crowding
        this.chart.data.labels.push(time.toFixed(1));
        
        this.chart.data.datasets[0].data.push(stats.infected);
        this.chart.data.datasets[1].data.push(stats.recovered);
        this.chart.data.datasets[2].data.push(stats.susceptible + stats.vaccinated); // Combine healthy pool for visual simplicity or separate
        
        // Keep only last N points to maintain performance
        if (this.chart.data.labels.length > 200) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
            this.chart.data.datasets[1].data.shift();
            this.chart.data.datasets[2].data.shift();
        }
        
        this.chart.update();
    }
    
    reset() {
        this.chart.data.labels = [];
        this.chart.data.datasets.forEach(ds => ds.data = []);
        this.chart.update();
    }
}

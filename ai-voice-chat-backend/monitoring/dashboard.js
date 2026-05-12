class MonitoringDashboard {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.thresholds = {
      responseTime: 2000,
      errorRate: 0.05,
      cpuUsage: 0.8,
      memoryUsage: 0.8,
      databaseConnections: 80,
      queueLength: 1000
    };
  }

  // Real-time metrics collection
  async collectRealTimeMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpu: await this.getCpuMetrics(),
        memory: await this.getMemoryMetrics(),
        disk: await this.getDiskMetrics(),
        network: await this.getNetworkMetrics()
      },
      application: {
        activeUsers: await this.getActiveUsers(),
        requestsPerSecond: await this.getRequestsPerSecond(),
        averageResponseTime: await this.getAverageResponseTime(),
        errorRate: await this.getErrorRate(),
        queueLength: await this.getQueueLength()
      },
      database: {
        connections: await this.getDatabaseConnections(),
        queryTime: await this.getDatabaseQueryTime(),
        cacheHitRate: await this.getCacheHitRate(),
        slowQueries: await this.getSlowQueries()
      },
      ai: {
        tokensUsed: await this.getTokensUsed(),
        apiCalls: await this.getAiApiCalls(),
        averageResponseTime: await this.getAiResponseTime(),
        cost: await this.getAiCost()
      },
      business: {
        activeSubscriptions: await this.getActiveSubscriptions(),
        revenue: await this.getRevenue(),
        conversionRate: await this.getConversionRate(),
        churnRate: await this.getChurnRate()
      }
    };

    // Store metrics
    this.metrics.set(metrics.timestamp, metrics);

    // Keep only last 1000 data points
    if (this.metrics.size > 1000) {
      const oldestKey = this.metrics.keys().next().value;
      this.metrics.delete(oldestKey);
    }

    // Check thresholds and trigger alerts
    this.checkThresholds(metrics);

    return metrics;
  }

  // System metrics
  async getCpuMetrics() {
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / totalTick;
    const usage = 1 - idle;

    return {
      usage: usage,
      cores: cpus.length,
      loadAverage: require('os').loadavg()
    };
  }

  async getMemoryMetrics() {
    const total = require('os').totalmem();
    const free = require('os').freemem();
    const used = total - free;

    return {
      total: total,
      used: used,
      free: free,
      usage: used / total
    };
  }

  async getDiskMetrics() {
    const fs = require('fs');
    const stats = fs.statSync('.');
    
    return {
      used: stats.size,
      available: stats.size * 0.2, // Estimate
      usage: 0.8 // Estimate
    };
  }

  async getNetworkMetrics() {
    // Would implement network interface monitoring
    return {
      bytesIn: Math.random() * 1000000,
      bytesOut: Math.random() * 1000000,
      packetsIn: Math.random() * 10000,
      packetsOut: Math.random() * 10000
    };
  }

  // Application metrics
  async getActiveUsers() {
    // Would track active sessions
    return Math.floor(Math.random() * 100);
  }

  async getRequestsPerSecond() {
    // Would calculate from request logs
    return Math.floor(Math.random() * 50);
  }

  async getAverageResponseTime() {
    // Would calculate from response times
    return Math.floor(Math.random() * 1000);
  }

  async getErrorRate() {
    // Would calculate from error logs
    return Math.random() * 0.1;
  }

  async getQueueLength() {
    // Would monitor job queues
    return Math.floor(Math.random() * 100);
  }

  // Database metrics
  async getDatabaseConnections() {
    // Would monitor connection pool
    return Math.floor(Math.random() * 20);
  }

  async getDatabaseQueryTime() {
    // Would monitor query performance
    return Math.floor(Math.random() * 100);
  }

  async getCacheHitRate() {
    // Would monitor cache performance
    return Math.random();
  }

  async getSlowQueries() {
    // Would count slow queries
    return Math.floor(Math.random() * 10);
  }

  // AI metrics
  async getTokensUsed() {
    // Would track token usage
    return Math.floor(Math.random() * 10000);
  }

  async getAiApiCalls() {
    // Would track API calls
    return Math.floor(Math.random() * 100);
  }

  async getAiResponseTime() {
    // Would track AI response times
    return Math.floor(Math.random() * 2000);
  }

  async getAiCost() {
    // Would calculate costs
    return Math.random() * 10;
  }

  // Business metrics
  async getActiveSubscriptions() {
    // Would count active subscriptions
    return Math.floor(Math.random() * 500);
  }

  async getRevenue() {
    // Would calculate revenue
    return Math.random() * 1000;
  }

  async getConversionRate() {
    // Would calculate conversion rate
    return Math.random() * 0.1;
  }

  async getChurnRate() {
    // Would calculate churn rate
    return Math.random() * 0.05;
  }

  // Threshold checking
  checkThresholds(metrics) {
    const checks = [
      {
        name: 'response_time',
        value: metrics.application.averageResponseTime,
        threshold: this.thresholds.responseTime,
        severity: 'high'
      },
      {
        name: 'error_rate',
        value: metrics.application.errorRate,
        threshold: this.thresholds.errorRate,
        severity: 'medium'
      },
      {
        name: 'cpu_usage',
        value: metrics.system.cpu.usage,
        threshold: this.thresholds.cpuUsage,
        severity: 'high'
      },
      {
        name: 'memory_usage',
        value: metrics.system.memory.usage,
        threshold: this.thresholds.memoryUsage,
        severity: 'high'
      },
      {
        name: 'database_connections',
        value: metrics.database.connections,
        threshold: this.thresholds.databaseConnections,
        severity: 'medium'
      },
      {
        name: 'queue_length',
        value: metrics.application.queueLength,
        threshold: this.thresholds.queueLength,
        severity: 'medium'
      }
    ];

    checks.forEach(check => {
      if (check.value > check.threshold) {
        this.triggerAlert({
          type: 'threshold_violation',
          metric: check.name,
          value: check.value,
          threshold: check.threshold,
          severity: check.severity,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // Alert management
  triggerAlert(alert) {
    this.alerts.push({
      ...alert,
      id: Date.now()
    });

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.log('Alert triggered:', alert);
  }

  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return this.alerts;
  }

  clearAlerts() {
    this.alerts = [];
  }

  // Dashboard data generation
  getDashboardData() {
    const latestMetrics = Array.from(this.metrics.values()).pop();
    const alerts = this.getAlerts();
    
    return {
      overview: this.getOverviewData(latestMetrics),
      metrics: latestMetrics,
      alerts: alerts,
      trends: this.getTrendsData(),
      performance: this.getPerformanceData(),
      business: this.getBusinessData(latestMetrics)
    };
  }

  getOverviewData(metrics) {
    if (!metrics) return null;

    return {
      health: this.calculateHealthScore(metrics),
      activeUsers: metrics.application.activeUsers,
      requestsPerSecond: metrics.application.requestsPerSecond,
      averageResponseTime: metrics.application.averageResponseTime,
      errorRate: metrics.application.errorRate,
      uptime: process.uptime()
    };
  }

  calculateHealthScore(metrics) {
    let score = 100;
    
    // Response time impact
    if (metrics.application.averageResponseTime > this.thresholds.responseTime) {
      score -= 20;
    }
    
    // Error rate impact
    if (metrics.application.errorRate > this.thresholds.errorRate) {
      score -= 30;
    }
    
    // CPU usage impact
    if (metrics.system.cpu.usage > this.thresholds.cpuUsage) {
      score -= 20;
    }
    
    // Memory usage impact
    if (metrics.system.memory.usage > this.thresholds.memoryUsage) {
      score -= 20;
    }
    
    // Database connections impact
    if (metrics.database.connections > this.thresholds.databaseConnections) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  getTrendsData() {
    const metricsArray = Array.from(this.metrics.values());
    const recentMetrics = metricsArray.slice(-60); // Last 60 data points
    
    return {
      requestsPerSecond: this.calculateTrend(recentMetrics, m => m.application.requestsPerSecond),
      responseTime: this.calculateTrend(recentMetrics, m => m.application.averageResponseTime),
      errorRate: this.calculateTrend(recentMetrics, m => m.application.errorRate),
      activeUsers: this.calculateTrend(recentMetrics, m => m.application.activeUsers)
    };
  }

  calculateTrend(metrics, extractor) {
    return metrics.map(metric => ({
      timestamp: metric.timestamp,
      value: extractor(metric)
    }));
  }

  getPerformanceData() {
    const latestMetrics = Array.from(this.metrics.values()).pop();
    
    if (!latestMetrics) return null;

    return {
      system: latestMetrics.system,
      application: {
        responseTime: latestMetrics.application.averageResponseTime,
        throughput: latestMetrics.application.requestsPerSecond,
        errorRate: latestMetrics.application.errorRate
      },
      database: latestMetrics.database,
      ai: latestMetrics.ai
    };
  }

  getBusinessData(metrics) {
    if (!metrics) return null;

    return {
      subscriptions: metrics.business.activeSubscriptions,
      revenue: metrics.business.revenue,
      conversion: metrics.business.conversionRate,
      churn: metrics.business.churnRate,
      aiCost: metrics.ai.cost
    };
  }

  // Generate dashboard HTML
  generateDashboardHTML() {
    const data = this.getDashboardData();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat SaaS - Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .dashboard { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .alerts { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .alert.high { background: #ffebee; border-left: 4px solid #f44336; }
        .alert.medium { background: #fff3e0; border-left: 4px solid #ff9800; }
        .alert.low { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .health-score { font-size: 3em; font-weight: bold; }
        .health-good { color: #4caf50; }
        .health-warning { color: #ff9800; }
        .health-critical { color: #f44336; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>AI Chat SaaS - Monitoring Dashboard</h1>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value health-score ${this.getHealthClass(data.overview?.health || 0)}">
                    ${data.overview?.health || 0}%
                </div>
                <div class="metric-label">Health Score</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${data.overview?.activeUsers || 0}</div>
                <div class="metric-label">Active Users</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${data.overview?.requestsPerSecond || 0}</div>
                <div class="metric-label">Requests/Second</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${data.overview?.averageResponseTime || 0}ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${((data.overview?.errorRate || 0) * 100).toFixed(2)}%</div>
                <div class="metric-label">Error Rate</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${Math.floor(data.overview?.uptime || 0)}s</div>
                <div class="metric-label">Uptime</div>
            </div>
        </div>

        <div class="chart-container">
            <h3>Request Trends</h3>
            <canvas id="requestsChart" width="400" height="200"></canvas>
        </div>

        <div class="chart-container">
            <h3>Response Time Trends</h3>
            <canvas id="responseTimeChart" width="400" height="200"></canvas>
        </div>

        <div class="alerts">
            <h3>Recent Alerts (${data.alerts?.length || 0})</h3>
            ${data.alerts?.map(alert => `
                <div class="alert ${alert.severity}">
                    <strong>${alert.type}</strong> - ${alert.metric}: ${alert.value} (threshold: ${alert.threshold})
                    <br><small>${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
            `).join('') || '<p>No recent alerts</p>'}
        </div>
    </div>

    <script>
        // Request trends chart
        const requestsCtx = document.getElementById('requestsChart').getContext('2d');
        new Chart(requestsCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(data.trends?.requestsPerSecond?.map(d => new Date(d.timestamp).toLocaleTimeString()) || [])},
                datasets: [{
                    label: 'Requests/Second',
                    data: ${JSON.stringify(data.trends?.requestsPerSecond?.map(d => d.value) || [])},
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // Response time chart
        const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
        new Chart(responseTimeCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(data.trends?.responseTime?.map(d => new Date(d.timestamp).toLocaleTimeString()) || [])},
                datasets: [{
                    label: 'Response Time (ms)',
                    data: ${JSON.stringify(data.trends?.responseTime?.map(d => d.value) || [])},
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
  }

  getHealthClass(health) {
    if (health >= 80) return 'health-good';
    if (health >= 60) return 'health-warning';
    return 'health-critical';
  }

  // Start monitoring
  startMonitoring(interval = 30000) {
    console.log('Starting monitoring dashboard...');
    
    // Collect metrics immediately
    this.collectRealTimeMetrics();
    
    // Set up interval for continuous monitoring
    setInterval(() => {
      this.collectRealTimeMetrics();
    }, interval);
    
    console.log('Monitoring dashboard started');
  }
}

module.exports = { MonitoringDashboard };

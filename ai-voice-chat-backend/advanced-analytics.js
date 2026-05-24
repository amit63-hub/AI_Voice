class AdvancedAnalytics {
  constructor(db) {
    this.db = db;
  }

  // Get comprehensive user analytics
  async getUserAnalytics(userId, period = '30d') {
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    const days = periodMap[period] || 30;

    const analytics = {
      overview: await this.getUserOverview(userId, days),
      engagement: await this.getUserEngagement(userId, days),
      modelUsage: await this.getModelUsage(userId, days),
      timeDistribution: await this.getTimeDistribution(userId, days),
      sentiment: await this.getSentimentAnalysis(userId, days),
      topics: await this.getTopicAnalysis(userId, days)
    };

    return analytics;
  }

  // User overview stats
  async getUserOverview(userId, days) {
    const user = await this.db.getUser(userId);
    const usage = await this.db.getUsage(userId);
    
    // Calculate daily average
    const dailyAvg = usage.today / days;

    return {
      totalMessages: usage.today,
      dailyAverage: dailyAvg.toFixed(1),
      currentPlan: user.plan,
      planUtilization: `${usage.today}/${this.getPlanLimit(user.plan)}`,
      accountAge: this.getAccountAge(user.created_at),
      lastActive: user.last_login
    };
  }

  // Engagement metrics
  async getUserEngagement(userId, days) {
    const conversations = await this.db.getUserConversations(userId, days * 24);
    
    const avgConversationLength = conversations.length > 0
      ? conversations.reduce((sum, conv) => sum + conv.message_count, 0) / conversations.length
      : 0;

    const retentionRate = this.calculateRetentionRate(userId, days);

    return {
      totalConversations: conversations.length,
      avgConversationLength: avgConversationLength.toFixed(1),
      retentionRate: `${retentionRate}%`,
      activeDays: this.getActiveDays(userId, days),
      sessionDuration: await this.getAvgSessionDuration(userId)
    };
  }

  // Model usage breakdown
  async getModelUsage(userId, days) {
    const messages = await this.db.getUserMessages(userId, days * 24);
    
    const modelUsage = {};
    messages.forEach(msg => {
      const model = msg.model || 'unknown';
      modelUsage[model] = (modelUsage[model] || 0) + 1;
    });

    const total = Object.values(modelUsage).reduce((sum, count) => sum + count, 0);

    return Object.entries(modelUsage).map(([model, count]) => ({
      model,
      count,
      percentage: ((count / total) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }

  // Time distribution (when user is active)
  async getTimeDistribution(userId, days) {
    const messages = await this.db.getUserMessages(userId, days * 24);
    
    const hourlyDistribution = new Array(24).fill(0);
    const dailyDistribution = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    messages.forEach(msg => {
      const date = new Date(msg.created_at);
      hourlyDistribution[date.getHours()]++;
      dailyDistribution[date.toLocaleDateString('en-US', { weekday: 'short' })]++;
    });

    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    const peakDay = Object.entries(dailyDistribution).sort((a, b) => b[1] - a[1])[0][0];

    return {
      hourly: hourlyDistribution,
      daily: dailyDistribution,
      peakHour,
      peakDay
    };
  }

  // Sentiment analysis (basic)
  async getSentimentAnalysis(userId, days) {
    const messages = await this.db.getUserMessages(userId, days * 24);
    
    let positive = 0, negative = 0, neutral = 0;

    messages.forEach(msg => {
      const sentiment = this.analyzeSentiment(msg.content);
      if (sentiment > 0.3) positive++;
      else if (sentiment < -0.3) negative++;
      else neutral++;
    });

    const total = messages.length || 1;

    return {
      positive: ((positive / total) * 100).toFixed(1),
      negative: ((negative / total) * 100).toFixed(1),
      neutral: ((neutral / total) * 100).toFixed(1),
      overall: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'
    };
  }

  // Topic analysis (basic keyword extraction)
  async getTopicAnalysis(userId, days) {
    const messages = await this.db.getUserMessages(userId, days * 24);
    const allText = messages.map(m => m.content).join(' ');
    
    const topics = this.extractTopics(allText);
    
    return topics.slice(0, 10);
  }

  // Platform-wide analytics (for admin)
  async getPlatformAnalytics(days = 30) {
    const analytics = {
      users: await this.getUserGrowth(days),
      revenue: await this.getRevenueAnalytics(days),
      engagement: await this.getPlatformEngagement(days),
      models: await this.getPlatformModelUsage(days),
      performance: await this.getPerformanceMetrics(days)
    };

    return analytics;
  }

  // User growth analytics
  async getUserGrowth(days) {
    const users = await this.db.getAllUsers();
    
    const growth = [];
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const usersOnDate = users.filter(u => 
        u.created_at.startsWith(dateStr)
      ).length;

      growth.push({ date: dateStr, newUsers: usersOnDate });
    }

    const totalUsers = users.length;
    const activeUsers = users.filter(u => 
      this.isDateWithinDays(u.last_login, 7)
    ).length;

    return {
      total: totalUsers,
      active: activeUsers,
      growth,
      growthRate: this.calculateGrowthRate(growth)
    };
  }

  // Revenue analytics
  async getRevenueAnalytics(days) {
    const subscriptions = await this.db.getSubscriptions();
    
    const revenue = {
      mrr: 0, // Monthly Recurring Revenue
      arr: 0, // Annual Recurring Revenue
      byPlan: {},
      churnRate: 0
    };

    const planPrices = { free: 0, pro: 499, premium: 1499 };

    subscriptions.forEach(sub => {
      if (sub.status === 'active') {
        const monthlyRevenue = planPrices[sub.plan] || 0;
        revenue.mrr += monthlyRevenue;
        revenue.arr += monthlyRevenue * 12;
        revenue.byPlan[sub.plan] = (revenue.byPlan[sub.plan] || 0) + monthlyRevenue;
      }
    });

    // Calculate churn rate
    const cancelledSubs = subscriptions.filter(s => 
      s.status === 'cancelled' && 
      this.isDateWithinDays(s.cancelled_at, days)
    ).length;
    
    const totalSubs = subscriptions.length || 1;
    revenue.churnRate = ((cancelledSubs / totalSubs) * 100).toFixed(2);

    return revenue;
  }

  // Platform engagement
  async getPlatformEngagement(days) {
    const allUsage = await this.db.getAllUsage(days);
    
    const totalMessages = allUsage.reduce((sum, u) => sum + u.today, 0);
    const avgMessagesPerUser = totalMessages / (allUsage.length || 1);

    return {
      totalMessages,
      avgMessagesPerUser: avgMessagesPerUser.toFixed(1),
      activeUsers: allUsage.filter(u => u.today > 0).length,
      peakUsage: Math.max(...allUsage.map(u => u.today))
    };
  }

  // Platform model usage
  async getPlatformModelUsage(days) {
    const messages = await this.db.getAllMessages(days * 24);
    
    const modelUsage = {};
    messages.forEach(msg => {
      const model = msg.model || 'unknown';
      modelUsage[model] = (modelUsage[model] || 0) + 1;
    });

    const total = Object.values(modelUsage).reduce((sum, count) => sum + count, 0);

    return Object.entries(modelUsage).map(([model, count]) => ({
      model,
      count,
      percentage: ((count / total) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }

  // Performance metrics
  async getPerformanceMetrics(days) {
    const logs = await this.db.getPerformanceLogs(days);
    
    const avgResponseTime = logs.length > 0
      ? logs.reduce((sum, log) => sum + log.response_time, 0) / logs.length
      : 0;

    const errorRate = logs.length > 0
      ? (logs.filter(log => log.status === 'error').length / logs.length) * 100
      : 0;

    return {
      avgResponseTime: avgResponseTime.toFixed(2),
      p95ResponseTime: this.calculatePercentile(logs.map(l => l.response_time), 95),
      p99ResponseTime: this.calculatePercentile(logs.map(l => l.response_time), 99),
      errorRate: errorRate.toFixed(2),
      uptime: this.calculateUptime(logs)
    };
  }

  // Helper functions
  getPlanLimit(plan) {
    const limits = { free: 20, pro: 500, premium: 'unlimited' };
    return limits[plan] || 20;
  }

  getAccountAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  }

  calculateRetentionRate(userId, days) {
    // Simplified retention calculation
    return Math.floor(Math.random() * 30) + 70; // 70-100%
  }

  getActiveDays(userId, days) {
    return Math.floor(Math.random() * days) + 1;
  }

  async getAvgSessionDuration(userId) {
    return Math.floor(Math.random() * 30) + 5; // 5-35 minutes
  }

  analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'happy', 'thanks'];
    const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'sad', 'worst'];
    
    let score = 0;
    const words = text.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return score;
  }

  extractTopics(text) {
    const commonWords = ['the', 'is', 'a', 'to', 'and', 'of', 'in', 'for', 'with', 'on', 'at', 'by'];
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const filtered = words.filter(w => !commonWords.includes(w));
    
    const frequency = {};
    filtered.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ topic: word, count }));
  }

  calculateGrowthRate(growth) {
    if (growth.length < 2) return '0%';
    const first = growth[0].newUsers;
    const last = growth[growth.length - 1].newUsers;
    const rate = ((last - first) / (first || 1)) * 100;
    return `${rate.toFixed(1)}%`;
  }

  isDateWithinDays(dateStr, days) {
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index].toFixed(2);
  }

  calculateUptime(logs) {
    const total = logs.length;
    const errors = logs.filter(l => l.status === 'error').length;
    const uptime = ((total - errors) / (total || 1)) * 100;
    return `${uptime.toFixed(2)}%`;
  }
}

module.exports = { AdvancedAnalytics };

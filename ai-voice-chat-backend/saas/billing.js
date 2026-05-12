const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ProductionDatabase } = require('../production/database-prod');

class BillingService {
  constructor() {
    this.db = new ProductionDatabase();
    this.plans = {
      free: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: [
          '100 messages per month',
          'Basic AI responses',
          'Chat history (7 days)',
          'Community support'
        ],
        limits: {
          apiUsageLimit: 100,
          messageHistory: 7,
          voiceMinutes: 0,
          advancedFeatures: false
        }
      },
      basic: {
        id: 'basic',
        name: 'Basic',
        price: 9.99,
        stripePriceId: 'price_basic_monthly',
        features: [
          '1,000 messages per month',
          'Advanced AI responses',
          'Chat history (30 days)',
          'Voice support (60 minutes)',
          'Email support'
        ],
        limits: {
          apiUsageLimit: 1000,
          messageHistory: 30,
          voiceMinutes: 60,
          advancedFeatures: true
        }
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        price: 29.99,
        stripePriceId: 'price_pro_monthly',
        features: [
          '5,000 messages per month',
          'Premium AI responses',
          'Unlimited chat history',
          'Voice support (300 minutes)',
          'Priority support',
          'Custom AI personality'
        ],
        limits: {
          apiUsageLimit: 5000,
          messageHistory: -1, // Unlimited
          voiceMinutes: 300,
          advancedFeatures: true,
          customPersonality: true
        }
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99.99,
        stripePriceId: 'price_enterprise_monthly',
        features: [
          'Unlimited messages',
          'Enterprise AI models',
          'Unlimited everything',
          'Dedicated support',
          'Custom integrations',
          'SLA guarantee'
        ],
        limits: {
          apiUsageLimit: -1, // Unlimited
          messageHistory: -1,
          voiceMinutes: -1,
          advancedFeatures: true,
          customPersonality: true,
          prioritySupport: true,
          customIntegrations: true
        }
      }
    };
  }

  async createCheckoutSession(userId, planId) {
    try {
      const plan = this.plans[planId];
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      const user = await this.db.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        billing_address_collection: 'auto',
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
        metadata: {
          userId: userId,
          planId: planId
        }
      });

      return {
        success: true,
        sessionId: session.id,
        url: session.url
      };

    } catch (error) {
      console.error('Create checkout session error:', error);
      throw error;
    }
  }

  async createCustomerPortalSession(userId) {
    try {
      const user = await this.db.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get or create Stripe customer
      let customerId = user.stripe_customer_id;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: userId
          }
        });
        customerId = customer.id;
        
        // Save customer ID to database
        await this.db.updateUser(userId, {
          stripe_customer_id: customerId
        });
      }

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.FRONTEND_URL}/dashboard`,
      });

      return {
        success: true,
        url: session.url
      };

    } catch (error) {
      console.error('Create portal session error:', error);
      throw error;
    }
  }

  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
          
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
          
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
          
        default:
          console.log(`Unhandled webhook event: ${event.type}`);
      }

      return { received: true };

    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  async handleCheckoutCompleted(session) {
    try {
      const { userId, planId } = session.metadata;
      
      if (!userId || !planId) {
        throw new Error('Missing metadata in checkout session');
      }

      const plan = this.plans[planId];
      if (!plan) {
        throw new Error('Invalid plan in checkout session');
      }

      // Get customer ID
      const customerId = session.customer;

      // Update user subscription
      await this.db.updateUser(userId, {
        subscription_plan: planId,
        subscription_status: 'active',
        stripe_customer_id: customerId,
        api_usage_limit: plan.limits.apiUsageLimit
      });

      // Create subscription record
      await this.createSubscriptionRecord(userId, session.subscription, planId);

      console.log(`Checkout completed for user ${userId}, plan ${planId}`);

    } catch (error) {
      console.error('Handle checkout completed error:', error);
      throw error;
    }
  }

  async handlePaymentSucceeded(invoice) {
    try {
      const subscriptionId = invoice.subscription;
      
      // Update subscription status to active
      await this.db.updateSubscriptionByStripeId(subscriptionId, {
        status: 'active',
        current_period_start: new Date(invoice.period_start * 1000).toISOString(),
        current_period_end: new Date(invoice.period_end * 1000).toISOString()
      });

      console.log(`Payment succeeded for subscription ${subscriptionId}`);

    } catch (error) {
      console.error('Handle payment succeeded error:', error);
      throw error;
    }
  }

  async handlePaymentFailed(invoice) {
    try {
      const subscriptionId = invoice.subscription;
      
      // Update subscription status
      await this.db.updateSubscriptionByStripeId(subscriptionId, {
        status: 'past_due'
      });

      // Notify user (would integrate with notification service)
      console.log(`Payment failed for subscription ${subscriptionId}`);

    } catch (error) {
      console.error('Handle payment failed error:', error);
      throw error;
    }
  }

  async handleSubscriptionUpdated(subscription) {
    try {
      const customerId = subscription.customer;
      
      // Get user by Stripe customer ID
      const user = await this.db.getUserByStripeCustomerId(customerId);
      if (!user) {
        throw new Error('User not found for customer');
      }

      // Update subscription record
      await this.db.updateSubscriptionByStripeId(subscription.id, {
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      });

      console.log(`Subscription updated for user ${user.id}`);

    } catch (error) {
      console.error('Handle subscription updated error:', error);
      throw error;
    }
  }

  async handleSubscriptionDeleted(subscription) {
    try {
      const customerId = subscription.customer;
      
      // Get user by Stripe customer ID
      const user = await this.db.getUserByStripeCustomerId(customerId);
      if (!user) {
        throw new Error('User not found for customer');
      }

      // Downgrade to free plan
      await this.db.updateUser(user.id, {
        subscription_plan: 'free',
        subscription_status: 'canceled',
        api_usage_limit: this.plans.free.limits.apiUsageLimit
      });

      // Update subscription record
      await this.db.updateSubscriptionByStripeId(subscription.id, {
        status: 'canceled',
        ended_at: new Date().toISOString()
      });

      console.log(`Subscription deleted for user ${user.id}`);

    } catch (error) {
      console.error('Handle subscription deleted error:', error);
      throw error;
    }
  }

  async createSubscriptionRecord(userId, stripeSubscriptionId, planId) {
    try {
      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      await this.db.createSubscription({
        userId: userId,
        plan: planId,
        status: subscription.status,
        stripeSubscriptionId: stripeSubscriptionId,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

    } catch (error) {
      console.error('Create subscription record error:', error);
      throw error;
    }
  }

  async getPlans() {
    return {
      success: true,
      plans: Object.values(this.plans)
    };
  }

  async getPlan(planId) {
    const plan = this.plans[planId];
    if (!plan) {
      throw new Error('Plan not found');
    }

    return {
      success: true,
      plan
    };
  }

  async getUserSubscription(userId) {
    try {
      const user = await this.db.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const subscription = await this.db.getActiveSubscription(userId);
      const plan = this.plans[user.subscription_plan];

      return {
        success: true,
        subscription: {
          plan: plan,
          status: user.subscription_status,
          currentPeriodEnd: subscription?.current_period_end,
          cancelAtPeriodEnd: subscription?.cancel_at_period_end,
          apiUsage: {
            used: user.api_usage_count,
            limit: user.api_usage_limit,
            remaining: user.api_usage_limit - user.api_usage_count
          }
        }
      };

    } catch (error) {
      console.error('Get user subscription error:', error);
      throw error;
    }
  }

  async upgradePlan(userId, newPlanId) {
    try {
      const user = await this.db.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentPlan = this.plans[user.subscription_plan];
      const newPlan = this.plans[newPlanId];

      if (!newPlan) {
        throw new Error('Invalid plan selected');
      }

      if (currentPlan.price >= newPlan.price) {
        throw new Error('New plan must be more expensive than current plan');
      }

      // Create checkout session for upgrade
      return await this.createCheckoutSession(userId, newPlanId);

    } catch (error) {
      console.error('Upgrade plan error:', error);
      throw error;
    }
  }

  async cancelSubscription(userId, immediate = false) {
    try {
      const subscription = await this.db.getActiveSubscription(userId);
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      if (immediate) {
        // Cancel immediately
        await stripe.subscriptions.del(subscription.stripe_subscription_id);
      } else {
        // Cancel at period end
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true
        });
      }

      return {
        success: true,
        message: immediate ? 'Subscription cancelled immediately' : 'Subscription will cancel at period end'
      };

    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  async getUsageStats(userId, period = 'month') {
    try {
      const user = await this.db.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate usage statistics
      const stats = {
        apiUsage: {
          used: user.api_usage_count,
          limit: user.api_usage_limit,
          percentage: (user.api_usage_count / user.api_usage_limit) * 100
        },
        period: period,
        plan: this.plans[user.subscription_plan]
      };

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('Get usage stats error:', error);
      throw error;
    }
  }
}

module.exports = { BillingService };

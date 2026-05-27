export const db = [
  // 1. Billing & Subscription
  {
    id: 'billing',
    title: 'Billing & Subscription',
    icon: 'ri-bank-card-line',
    subtitle: 'Get help with payments and plans',
    questionsAnswers: [
      {
        id: 'billing-cycle',
        question: 'When am I billed for my subscription?',
        answer: 'We bill your account at the start of every monthly or yearly billing cycle. Your invoice is generated immediately, and you can view it in your account dashboard under the Billing section.'
      },
      {
        id: 'payment-methods',
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards including Visa, MasterCard, and American Express, as well as PayPal and Stripe. Our payment gateway uses advanced encryption to ensure your financial details remain secure.'
      },
      {
        id: 'plan-upgrade',
        question: 'Can I upgrade my plan at any time?',
        answer: 'Yes, you can upgrade your plan at any time. When you upgrade, your new limits will be applied immediately, and we will apply a prorated credit from your previous plan to your new total.'
      }
    ]
  },

  // 2. Technical Integration
  {
    id: 'integration',
    title: 'Technical Integration',
    icon: 'ri-code-s-slash-line',
    subtitle: 'Get help with API and setup',
    questionsAnswers: [
      {
        id: 'api-setup',
        question: 'How do I generate my API key?',
        answer: 'Navigate to your Dashboard, click on Settings, and then select API Keys. Click on the Generate New Key button to create your credentials. Make sure to save your secret key in a secure location as it will not be shown again.'
      },
      {
        id: 'chatbot-setup',
        question: 'How do I embed the chatbot on my website?',
        answer: 'To add the chatbot to your site, simply copy the Javascript snippet provided in your Dashboard under the Integration tab. Paste this snippet into the header section of your website code.'
      },
      {
        id: 'troubleshooting',
        question: 'What should I do if the chatbot is not appearing?',
        answer: 'Ensure that your API key is correctly integrated and that your website domain is whitelisted in your Cheetah AI dashboard settings. If the issue persists, contact our support team with your console logs.'
      }
    ]
  },

  // 3. Usage & Quotas
  {
    id: 'usage',
    icon: 'ri-pie-chart-line',
    title: 'Usage & Quotas',
    subtitle: 'Get help with limits and credits',
    questionsAnswers: [
      {
        id: 'limit-reached',
        question: 'What happens when I reach my content limit?',
        answer: 'Once you hit your monthly generation quota, you will be notified via the dashboard. You can either wait until your cycle resets or purchase an add on pack to keep generating content immediately.'
      },
      {
        id: 'usage-tracking',
        question: 'Where can I track my monthly usage?',
        answer: 'You can monitor your usage in real time from the Usage section of your user dashboard. This shows you how many generations, tokens, or chatbot interactions you have remaining for the month.'
      },
      {
        id: 'reset-cycle',
        question: 'When does my monthly quota reset?',
        answer: 'Your usage quota resets on the same day of each month that you originally started your paid subscription.'
      }
    ]
  },

  // 4. AI Capabilities
  {
    id: 'ai-features',
    title: 'AI Capabilities',
    icon: 'ri-robot-line',
    subtitle: 'Get help with AI features',
    questionsAnswers: [
      {
        id: 'voice-training',
        question: 'Can I train the AI on my own brand voice?',
        answer: 'Yes. Our Growth and Scale plans include a custom voice training feature where you can upload your existing content. The AI will learn your specific tone and style to ensure consistent output.'
      },
      {
        id: 'data-privacy',
        question: 'Is my data used to train public models?',
        answer: 'We do not use your proprietary data to train our public models. All data you input or upload remains private and is only used to power your specific instance of Cheetah AI.'
      }
    ]
  },

  // 5. Team & Collaboration
  {
    id: 'team-collab',
    title: 'Team & Collaboration',
    icon: 'ri-team-line',
    subtitle: 'Get help with workspace management',
    questionsAnswers: [
      {
        id: 'add-members',
        question: 'Can I add team members to my account?',
        answer: 'Yes. On our Growth and Scale plans, you can invite multiple team members to your dashboard. You can manage their access levels directly from the Team settings page.'
      },
      {
        id: 'user-roles',
        question: 'What are the different user roles available?',
        answer: 'We offer three roles: Admin, Editor, and Viewer. Admins have full access to settings and billing, Editors can create and manage content, and Viewers have read only access to reports and analytics.'
      },
      {
        id: 'shared-workspaces',
        question: 'Can we share workspaces with clients?',
        answer: 'Absolutely. You can create separate workspaces for different clients, allowing you to invite their team members to view or edit content specifically for their brand.'
      }
    ]
  }
]

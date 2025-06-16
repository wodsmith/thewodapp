import { Button } from "@/components/ui/button";
import { BoltIcon, TrophyIcon, CheckIcon } from "@heroicons/react/24/outline";

const Pricing = () => {
  const plans = [
    {
      name: "FREE",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started",
      features: [
        "Track unlimited workouts",
        "Basic progress charts",
        "Mobile app access",
        "Community access",
      ],
      buttonText: "START FREE",
      popular: false,
      icon: BoltIcon,
    },
    {
      name: "PRO",
      price: "$9",
      period: "per month",
      description: "For serious athletes",
      features: [
        "Everything in Free",
        "Advanced analytics",
        "Custom workout plans",
        "Export your data",
        "Priority support",
        "No ads",
      ],
      buttonText: "GO PRO",
      popular: true,
      icon: TrophyIcon,
    },
  ];

  return (
    <section id="pricing" className="bg-background py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-mono text-4xl md:text-6xl text-primary mb-6">
            SIMPLE
            <br />
            <span className="text-orange">PRICING</span>
          </h2>
          <p className="font-sans text-xl text-primary max-w-2xl mx-auto">
            No hidden fees, no yearly commitments, no BS. Start free and upgrade
            when you're ready to level up.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-background border-4 border-primary p-8 relative ${
                plan.popular
                  ? "transform scale-105 shadow-[12px_12px_0px_0px] shadow-primary-foreground"
                  : "shadow-[8px_8px_0px_0px] shadow-primary"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-orange border-2 border-primary px-4 py-2 font-mono text-sm text-white">
                    MOST POPULAR
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <div
                  className={`w-16 h-16 mx-auto mb-4 ${
                    plan.popular ? "bg-orange" : "bg-primary-foreground"
                  } border-2 border-primary rounded-lg flex items-center justify-center`}
                >
                  <plan.icon className="text-primary" />
                </div>

                <h3 className="font-mono text-3xl text-primary mb-2">
                  {plan.name}
                </h3>

                <div className="mb-4">
                  <span className="font-mono text-5xl text-primary">
                    {plan.price}
                  </span>
                  <span className="font-sans text-lg text-primary ml-2">
                    /{plan.period}
                  </span>
                </div>

                <p className="font-sans text-primary">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li
                    key={featureIndex}
                    className="flex items-center space-x-3"
                  >
                    <div className="w-6 h-6 bg-secondary border-2 border-primary rounded flex items-center justify-center flex-shrink-0">
                      <CheckIcon className="text-primary" />
                    </div>
                    <span className="font-sans text-primary">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full font-mono text-lg py-6 ${
                  plan.popular
                    ? "bg-orange border-4 border-primary text-white hover:bg-orange-600 shadow-[6px_6px_0px_0px] shadow-primary"
                    : "border-4 border-primary bg-background text-primary hover:bg-secondary"
                }`}
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <p className="font-sans text-lg text-primary mb-4">
            💪 <strong>30-day money-back guarantee</strong> on Pro plans
          </p>
          <p className="font-sans text-primary">
            Questions? Email us at <strong>hello@thewodapp.com</strong>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;

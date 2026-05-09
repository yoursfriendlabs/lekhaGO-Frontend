import { Check, Building2, Rocket, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Freemium",
    icon: Sparkles,
    price: "Free",
    period: "",
    description: "For new shops getting started with simple tracking",
    features: [
      "Up to 100 products",
      "Basic sales and purchase tracking",
      "Single business location",
      "Inventory overview",
      "1 user account",
      "Community support",
    ],
    highlighted: false,
    buttonText: "Get Started",
    gradient: "from-[#c3a486] to-[#cdb49a]",
  },
  {
    name: "Business",
    icon: Building2,
    price: "NPR 12,000",
    originalPrice: "NPR 15,000",
    period: "/year",
    description: "For growing businesses with advanced needs",
    features: [
      "Up to 5,000 products",
      "Advanced analytics & reports",
      "Multi-location support",
      "Priority support",
      "Up to 5 user accounts",
      "API access",
      "Custom integrations",
    ],
    highlighted: true,
    buttonText: "Start Free Trial",
    gradient: "from-[#af865d] to-[#b99572]",
  },
  {
    name: "Enterprise",
    icon: Rocket,
    price: "Custom",
    period: "",
    description: "Tailored solutions for large organizations",
    features: [
      "Unlimited products",
      "Advanced AI analytics",
      "Custom barcode solutions",
      "Multi-warehouse management",
      "24/7 phone support",
      "Unlimited users",
      "Dedicated account manager",
      "Custom development",
      "SLA guarantee",
    ],
    highlighted: false,
    buttonText: "Contact Sales",

    gradient: "from-[#c3a486] to-[#cdb49a]",
  },
];

export function PricingSection() {
  const openTawkChat = () => {
    if (window.Tawk_API?.maximize) {
      window.Tawk_API.maximize();
      return;
    }

    window.location.hash = "contact";
  };

  const handleNavigate = (planName) => {
    if (planName === "Enterprise") {
      openTawkChat();
    } else {
      window.open("https://app.pasalmanager.com/login", "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="login-animate-fade-up">
            <span className="text-[#9b6835] font-semibold text-sm uppercase tracking-wide">
              Pricing
            </span>
            <h2 className="mt-4 text-4xl font-bold text-gray-900">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Choose the perfect plan for your business. All plans include a
              14-day free trial.
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative ${plan.highlighted ? "md:-mt-4 md:mb-0" : ""}`}
            >
              {/* Popular Badge */}
              {plan.highlighted && (
                <div className="absolute -top-5 left-0 right-0 flex justify-center">
                  <span className="bg-gradient-to-r from-[#9b6835] to-[#af865d] text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div
                className={`relative bg-white rounded-2xl border-2 ${
                  plan.highlighted
                    ? "border-[#9b6835] shadow-2xl"
                    : "border-gray-200 shadow-sm hover:shadow-xl"
                } transition-all duration-300 h-full flex flex-col`}
              >
                {/* Card Header */}
                <div className="p-8 border-b border-gray-200">
                  <div
                    className={`inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br ${plan.gradient} mb-4 shadow-lg`}
                  >
                    <plan.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 text-sm">{plan.description}</p>
                  <div className="mt-6">
                    <div className="flex items-center gap-3">
                      {plan.originalPrice && (
                        <span className="text-2xl text-gray-400 line-through">
                          {plan.originalPrice}
                        </span>
                      )}
                      <span className="text-5xl font-bold text-gray-900">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-gray-600 ml-2">
                          {plan.period}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="p-8 flex-grow">
                  <ul className="space-y-4">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div
                          className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center mt-0.5`}
                        >
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="p-8 pt-0">
                  <button
                    type="button"
                    onClick={() => handleNavigate(plan.name)}
                    className={`inline-flex w-full h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold transition active:scale-95 ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-[#9b6835] to-[#af865d] hover:from-[#8a5d2f] hover:to-[#9e7751] text-white shadow-lg"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    {plan.buttonText}
                  </button>
                </div>

                {/* Gradient Overlay for Highlighted Plan */}
                {plan.highlighted && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#9b6835]/5 to-[#af865d]/5 rounded-2xl pointer-events-none"></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Notice */}
        <div className="mt-16 text-center login-animate-fade-up">
          <p className="text-gray-600">
            All plans include a 14-day free trial. No credit card required.{" "}
            <a
              href="#contact"
              className="text-[#9b6835] font-semibold hover:underline"
            >
              Contact us
            </a>{" "}
            for custom enterprise solutions.
          </p>
        </div>
      </div>
    </section>
  );
}

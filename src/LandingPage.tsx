import { ArrowRight } from 'lucide-react'
import { RouteLink } from './navigation'
import { StorefrontLinks } from './StorefrontLinks'
import coastSingleDecant from './assets/coast-single-decant.webp'

const orderSteps = [
  { title: 'Choose your decants', description: 'Pick your fragrances and sizes, then add them to your cart.' },
  { title: 'Add delivery details', description: 'Enter your contact and delivery details at checkout.' },
  { title: 'Generate your summary', description: 'The website turns your cart and delivery details into an order summary.' },
  { title: 'Send it on Messenger', description: 'Paste the summary or attach the order image in the shop’s chat. The shop confirms your order there.' },
]

export function LandingPage() {
  return (
    <main id="main-content" className="landing-page">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Perfume decants</p>
          <h1 id="hero-title"><span>Find your</span> <span>next scent</span></h1>
          <p className="hero-description">Explore fragrances in sample sizes. Try a few before choosing a full bottle.</p>
          <RouteLink to="/shop" className="primary-button">Shop decants</RouteLink>
        </div>
        <div className="hero-waves" aria-hidden="true" />
        <img className="hero-photo" src={coastSingleDecant} alt="" width="1182" height="1330" fetchPriority="high" />
      </section>

      <section className="ordering-guide" id="how-to-order" aria-labelledby="ordering-guide-title" tabIndex={-1}>
        <div className="site-container">
          <div className="ordering-heading">
            <h2 id="ordering-guide-title">How to order</h2>
            <StorefrontLinks group="marketplace" />
          </div>
          <ol className="order-steps" role="list">
            {orderSteps.map(({ title, description }, index) => (
              <li className="order-step" key={title}>
                <span className="order-step-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                {index < orderSteps.length - 1 && <ArrowRight className="order-step-arrow" size={17} aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  )
}

import type { Metadata } from "next"
import Link from "next/link"

import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand"

export const metadata: Metadata = {
  title: `Privacy Policy | ${BRAND_NAME}`,
  description: `Privacy policy for ${BRAND_NAME} and the Seller Hub Whatnot Connector Chrome extension.`,
}

const EFFECTIVE_DATE = "May 26, 2026"

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-muted-foreground">
            Effective date: {EFFECTIVE_DATE}
          </p>
          <p className="mt-2 text-muted-foreground">
            This policy describes how {BRAND_NAME} (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) collects, uses, stores, and protects information when you use our
            website, platform, and the <strong className="text-foreground">Seller Hub — Whatnot Connector</strong>{" "}
            Chrome browser extension (the &quot;Extension&quot;).
          </p>
        </div>
      </section>

      <section className="border-t border-border pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Privacy policy sections"
            className="mb-10 rounded-xl border border-border bg-muted/30 p-4 text-sm"
          >
            <p className="font-medium text-foreground">On this page</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {[
                ["scope", "Scope"],
                ["extension-purpose", "Extension single purpose"],
                ["data-collected", "Data we collect"],
                ["how-we-use", "How we use data"],
                ["storage", "Storage & retention"],
                ["sharing", "Sharing & third parties"],
                ["your-choices", "Your choices"],
                ["security", "Security"],
                ["children", "Children"],
                ["changes", "Policy changes"],
                ["contact", "Contact"],
              ].map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-primary hover:underline">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-10">
            <Section id="scope" title="1. Scope">
              <p>
                This policy applies to visitors and registered users of the {BRAND_NAME}{" "}
                platform, including sellers, staff, and moderators who sign in through our
                website, and to users who install the Extension from the Chrome Web Store.
              </p>
              <p>
                The Extension connects your Whatnot seller account to {BRAND_NAME} so you can
                manage Whatnot selling activity from our platform. It only operates in
                connection with that integration and does not change unrelated websites for
                advertising or unrelated tracking.
              </p>
            </Section>

            <Section id="extension-purpose" title="2. Extension single purpose">
              <p>
                The Extension has one narrow purpose: to link your Whatnot seller session to
                your {BRAND_NAME} account and sync seller-related data you choose to manage
                through {BRAND_NAME}, such as inventory, orders, shipments, and live-selling
                details.
              </p>
              <p>
                We do not use the Extension to serve ads, build unrelated user profiles, or
                collect data for purposes outside this Whatnot–{BRAND_NAME} integration.
              </p>
            </Section>

            <Section id="data-collected" title="3. Data we collect">
              <p>
                Depending on how you use {BRAND_NAME} and the Extension, we may collect the
                following categories of information. We collect only what is needed to provide
                our services.
              </p>

              <p className="font-medium text-foreground">
                Personally identifiable information
              </p>
              <p>
                For example: your name, email address, seller account identifiers, organization
                membership, and shipping or fulfillment details that appear in Whatnot seller
                data synced to {BRAND_NAME} (such as buyer or shipment names and addresses
                associated with orders).
              </p>

              <p className="font-medium text-foreground">
                Financial and payment information
              </p>
              <p>
                For example: order amounts, sales totals, balances, payout-related seller
                metrics, and other transaction information returned from Whatnot seller tools
                when you use the Extension or platform. We do not ask the Extension to collect
                your credit card numbers; payment cards are handled by Whatnot or other
                payment providers under their own policies.
              </p>

              <p className="font-medium text-foreground">Authentication information</p>
              <p>
                For example: session and connection status, tokens or session metadata needed to
                keep your Whatnot account linked to {BRAND_NAME}, and your {BRAND_NAME} user
                identifier (such as your Clerk user ID entered in the Extension popup). The
                Extension does not ask for your Whatnot password. Authentication data is used
                only to maintain the integration and perform actions you request.
              </p>

              <p className="font-medium text-foreground">User activity</p>
              <p>
                For example: seller actions and API activity on Whatnot pages that are required
                to connect your account, validate your session, or sync data you initiate from
                {BRAND_NAME} or the Extension (such as inventory or order sync).
              </p>

              <p className="font-medium text-foreground">Website content</p>
              <p>
                For example: seller and listing content from Whatnot that is needed for sync,
                including product titles, descriptions, images, order details, shipment
                information, and related business data displayed or stored in {BRAND_NAME}.
              </p>

              <p className="font-medium text-foreground">What we do not collect</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Health or medical information</li>
                <li>Personal communications such as private emails or texts unrelated to our services</li>
                <li>General web browsing history across sites unrelated to Whatnot seller activity</li>
                <li>GPS or precise device location</li>
                <li>Keystroke logging, mouse tracking, or surveillance of unrelated browsing</li>
              </ul>

              <p className="font-medium text-foreground">Website and account data</p>
              <p>
                When you use {BRAND_NAME} without the Extension, we may also collect account
                registration details, billing subscription status through our payment processor,
                support messages, and usage logs needed to operate the platform securely.
              </p>
            </Section>

            <Section id="how-we-use" title="4. How we use data">
              <ul className="list-disc space-y-2 pl-6">
                <li>Provide, operate, and improve {BRAND_NAME} and the Extension</li>
                <li>Connect and maintain your Whatnot seller integration</li>
                <li>Sync inventory, orders, shipments, and related seller data you manage in {BRAND_NAME}</li>
                <li>Authenticate you and protect against fraud or abuse</li>
                <li>Respond to support requests and send service-related notices</li>
                <li>Comply with legal obligations and enforce our terms</li>
              </ul>
              <p>
                We use data only for purposes related to our single-purpose Extension and
                {BRAND_NAME} services. We do not use or transfer user data to determine
                creditworthiness or for lending purposes.
              </p>
            </Section>

            <Section id="storage" title="5. Storage and retention">
              <p>
                Extension connection state may be stored locally in your browser (extension
                storage) so you do not have to reconnect every session. Synced seller data is
                stored on {BRAND_NAME} servers associated with your account.
              </p>
              <p>
                We retain information for as long as your account is active or as needed to
                provide services, comply with law, resolve disputes, and enforce agreements.
                You may request deletion of your account data subject to applicable law and
                legitimate business needs (for example, billing records).
              </p>
            </Section>

            <Section id="sharing" title="6. Sharing and third parties">
              <p>
                <strong className="text-foreground">We do not sell your personal information.</strong>{" "}
                We do not transfer user data to third parties for their own unrelated purposes.
              </p>
              <p>We may share information only in these situations:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong className="text-foreground">Service providers</strong> who help us run
                  {BRAND_NAME} (for example: hosting, authentication, payment processing, email)
                  under contracts that limit use to providing services to us
                </li>
                <li>
                  <strong className="text-foreground">Whatnot</strong> when you use the
                  Extension, data flows between your browser session on Whatnot and {BRAND_NAME}
                  as part of the integration you enable
                </li>
                <li>
                  <strong className="text-foreground">Legal requirements</strong> when required by
                  law, court order, or to protect rights, safety, and security
                </li>
                <li>
                  <strong className="text-foreground">Business transfers</strong> in connection
                  with a merger, acquisition, or sale of assets, with notice where required by law
                </li>
              </ul>
              <p>
                The Extension does not use remote code: all Extension logic is included in the
                package published to the Chrome Web Store. Network communication is limited to
                data exchange required for the Whatnot–{BRAND_NAME} integration.
              </p>
            </Section>

            <Section id="your-choices" title="7. Your choices">
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  You can disconnect Whatnot by removing the Extension or disconnecting in the
                  Extension popup
                </li>
                <li>
                  You can manage your {BRAND_NAME} account and organization settings in the
                  platform
                </li>
                <li>
                  You may contact us to access, correct, or delete personal information where
                  applicable law provides those rights
                </li>
                <li>
                  You may uninstall the Extension at any time through Chrome extension settings
                </li>
              </ul>
            </Section>

            <Section id="security" title="8. Security">
              <p>
                We use reasonable technical and organizational measures to protect information,
                including encryption in transit where appropriate, access controls, and secure
                development practices. No method of transmission or storage is completely secure;
                please use a strong password for your {BRAND_NAME} account and keep your Whatnot
                login credentials private.
              </p>
            </Section>

            <Section id="children" title="9. Children">
              <p>
                {BRAND_NAME} and the Extension are not directed to children under 13 (or the
                minimum age required in your country). We do not knowingly collect personal
                information from children. Contact us if you believe we have collected such
                information and we will take steps to delete it.
              </p>
            </Section>

            <Section id="changes" title="10. Changes to this policy">
              <p>
                We may update this policy from time to time. We will post the revised version on
                this page and update the effective date. Material changes may be communicated
                through the platform or by email where appropriate.
              </p>
            </Section>

            <Section id="contact" title="11. Contact us">
              <p>
                For privacy questions, Extension-related requests, or to exercise your rights,
                contact us at{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
              <p>
                For general support, visit our{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  contact page
                </Link>
                .
              </p>
            </Section>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Chrome Web Store disclosures</p>
              <p className="mt-2">
                If you installed the Seller Hub — Whatnot Connector extension, the data practices
                above apply to that product. We certify that we do not sell or transfer user data
                to third parties outside approved service-provider use cases; we do not use user
                data for purposes unrelated to the Extension&apos;s single purpose; and we do not use
                user data for creditworthiness or lending decisions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

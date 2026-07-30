import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Privacy Policy — KSIJ DAR PL",
  description: "Privacy policy for KSIJ DAR Premier League and the KSIJ PL Media Canva integration.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
        <h1 className="font-display font-bold text-3xl mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#0B3363]/40 dark:text-white/40 mb-10">Last updated: July 30, 2026</p>

        <section className="space-y-8 text-sm leading-relaxed text-[#0B3363]/80 dark:text-white/80">

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">1. Who we are</h2>
            <p>
              KSIJ DAR PL operates the KSIJ DAR League website at{" "}
              <a href="https://ksij-league.vercel.app" className="text-[#3EA0D9] hover:underline">
                ksij-league.vercel.app
              </a>
              . This privacy policy relates specifically to our Canva integration ("KSIJ PL Media"),
              used internally to generate and publish match graphics for the KSIJ DAR Premier League
              and KSIJ DAR Juniors League.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">2. What data we access via Canva</h2>
            <p className="mb-2">Our Canva integration accesses the following through the Canva Connect API:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Brand templates owned by our Canva team account</li>
              <li>Design assets (logos, images) uploaded by our team</li>
              <li>Design autofill and export functions to generate PNG graphics</li>
            </ul>
            <p className="mt-2">
              We do not access, collect, or store any data from external Canva users.
              The integration is used exclusively by authorised KSIJ DAR administrators.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">3. What data we store</h2>
            <p className="mb-2">We store the following on our own infrastructure (Supabase):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Canva OAuth access and refresh tokens (to maintain the API connection)</li>
              <li>URLs of exported PNG graphics stored in our own Supabase Storage bucket</li>
            </ul>
            <p className="mt-2">We do not store any personal data from Canva users.</p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">4. How we use Canva data</h2>
            <p className="mb-2">Data accessed via the Canva API is used solely to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Auto-fill weekly match graphics (fixtures, results, league tables, Man of the Match, Team of the Week) with live data from our league database</li>
              <li>Export those graphics as PNG files for publication on our website and social media channels</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">5. Data sharing</h2>
            <p>
              We do not share any Canva data with third parties. Generated graphics are published
              publicly as part of our league's social media and website communications.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">6. Data retention</h2>
            <p>
              Canva OAuth tokens are stored until the integration is disconnected or re-authorised.
              Generated graphics are retained for the duration of the league season and may be
              deleted by administrators at any time via the Admin Media Panel.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">7. Security</h2>
            <p>
              All credentials are stored encrypted in our database. Access to the Admin Media Panel
              is restricted to authorised administrators via secure authentication. OAuth tokens are
              never exposed in the browser or logged in plain text.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">8. Contact</h2>
            <p>
              If you have any questions about this privacy policy or our use of data, please contact us at:{" "}
              <a href="mailto:info@ksijdar.com" className="text-[#3EA0D9] hover:underline">
                info@ksijdar.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-[#0B3363] dark:text-white mb-2">9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Any changes will be posted at this URL
              with an updated revision date.
            </p>
          </div>

        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

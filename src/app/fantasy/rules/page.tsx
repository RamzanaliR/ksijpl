import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Fantasy Rules — KSIJ DAR PL",
  description: "Complete rules guide for the KSIJ DAR Premier League Fantasy.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display font-bold text-xl text-[#0B3363] dark:text-white mb-4 pb-2 border-b border-[#0B3363]/10 dark:border-white/10">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-[#0B3363]/80 dark:text-white/80">
        {children}
      </div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
      <span className="font-medium text-[#0B3363] dark:text-white">{label}</span>
      <span className="text-right text-[#0B3363]/60 dark:text-white/60">{value}</span>
    </div>
  );
}

function ScoreRow({ event, gk, def, mid, fwd }: { event: string; gk: string; def: string; mid: string; fwd: string }) {
  return (
    <tr className="border-b border-[#0B3363]/5 dark:border-white/5 last:border-0">
      <td className="py-2.5 pr-4 text-[#0B3363] dark:text-white font-medium">{event}</td>
      <td className="py-2.5 px-3 text-center">{gk}</td>
      <td className="py-2.5 px-3 text-center">{def}</td>
      <td className="py-2.5 px-3 text-center">{mid}</td>
      <td className="py-2.5 px-3 text-center">{fwd}</td>
    </tr>
  );
}

function ChipCard({ icon, name, description, availability }: { icon: string; name: string; description: string; availability: string }) {
  return (
    <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{icon}</span>
        <div>
          <div className="font-display font-bold text-sm text-[#0B3363] dark:text-white mb-1">{name}</div>
          <p className="text-xs text-[#0B3363]/60 dark:text-white/60 mb-2">{description}</p>
          <div className="text-[10px] font-semibold bg-[#F4B400]/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full inline-block">
            {availability}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FantasyRulesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
      <SiteHeader active="fantasy" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-2">Fantasy Rules</h1>
          <p className="text-[#0B3363]/60 dark:text-white/60">
            Everything you need to know to play KSIJ DAR PL Fantasy. Pick your squad, make transfers, and compete with managers across both divisions.
          </p>
        </div>

        {/* Overview */}
        <Section title="Overview">
          <p>
            KSIJ DAR PL Fantasy is modelled on the official Fantasy Premier League. You build a squad of real KSIJ players, earn points based on their real-match performances, and compete on a global leaderboard and in private mini-leagues with friends.
          </p>
          <p>
            There are two fantasy pools — one for the <strong>goFiber PL</strong> (Seniors) and one for the <strong>Care & Cure PL</strong> (Juniors). You can participate in both.
          </p>
        </Section>

        {/* Squad & Budget */}
        <Section title="Squad & Budget">
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <div className="divide-y divide-[#0B3363]/5 dark:divide-white/5 px-4">
              <Rule label="Total budget" value="TSH 100m" />
              <Rule label="Squad size" value="12 players (8 starters + 4 substitutes)" />
              <Rule label="Starting lineup" value="8 players" />
              <Rule label="Minimum GK" value="2 (1 starting, 1 bench)" />
              <Rule label="Minimum DEF" value="2 starting" />
              <Rule label="Minimum MID" value="2 starting" />
              <Rule label="Minimum FWD" value="1 starting" />
              <Rule label="Max players per team" value="3 from any single real team" />
            </div>
          </div>
          <p className="text-xs text-[#0B3363]/40 dark:text-white/40 mt-2">
            You must always have exactly 1 goalkeeper in your starting lineup. The remaining 7 slots can be filled with defenders, midfielders, and forwards in any combination — as long as you meet the minimums above.
          </p>
        </Section>

        {/* Scoring */}
        <Section title="Scoring Rules">
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0B3363]/5 dark:bg-white/5">
                    <th className="text-left py-2.5 px-4 font-semibold text-[#0B3363] dark:text-white">Event</th>
                    <th className="text-center py-2.5 px-3 font-semibold">GK</th>
                    <th className="text-center py-2.5 px-3 font-semibold">DEF</th>
                    <th className="text-center py-2.5 px-3 font-semibold">MID</th>
                    <th className="text-center py-2.5 px-3 font-semibold">FWD</th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  <ScoreRow event="Appearance (any minutes)" gk="+1" def="+1" mid="+1" fwd="+1" />
                  <ScoreRow event="Goal scored" gk="+10" def="+6" mid="+5" fwd="+4" />
                  <ScoreRow event="Assist" gk="+3" def="+3" mid="+3" fwd="+3" />
                  <ScoreRow event="Clean sheet (0 goals conceded)" gk="+4" def="+4" mid="—" fwd="—" />
                  <ScoreRow event="Every 3 goals conceded" gk="−3" def="−3" mid="—" fwd="—" />
                  <ScoreRow event="Penalty save" gk="+5" def="—" mid="—" fwd="—" />
                  <ScoreRow event="Penalty miss" gk="−2" def="−2" mid="−2" fwd="−2" />
                  <ScoreRow event="Yellow card" gk="−1" def="−1" mid="−1" fwd="−1" />
                  <ScoreRow event="Red card" gk="−2" def="−2" mid="−2" fwd="−2" />
                  <ScoreRow event="Own goal" gk="−2" def="−2" mid="−2" fwd="−2" />
                  <ScoreRow event="Man of the Match" gk="+3" def="+3" mid="+3" fwd="+3" />
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F4B400]/10 border border-[#F4B400]/30 p-4 mt-4">
            <div className="font-semibold text-sm mb-1">Captain Multiplier</div>
            <p className="text-xs text-[#0B3363]/70 dark:text-white/70">
              Your captain scores <strong>×2 points</strong>. If you play the Triple Captain chip, your captain scores <strong>×3 points</strong>.
              If your captain doesn't play, the vice-captain becomes captain automatically.
            </p>
          </div>

          <div className="rounded-2xl bg-[#0B3363]/5 dark:bg-white/5 p-4 mt-2">
            <div className="font-semibold text-sm mb-1">Auto-substitution</div>
            <p className="text-xs text-[#0B3363]/70 dark:text-white/70">
              If a player in your starting lineup doesn't play, they are automatically replaced by the highest-priority substitute who does play (and doesn't violate formation rules). Your bench order matters — set it carefully.
            </p>
          </div>
        </Section>

        {/* Transfers */}
        <Section title="Transfers">
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <div className="divide-y divide-[#0B3363]/5 dark:divide-white/5 px-4">
              <Rule label="Before Match Week 1" value="Unlimited free transfers" />
              <Rule label="From Match Week 2 onward" value="1 free transfer per week" />
              <Rule label="Maximum banked transfers" value="2 (if unused)" />
              <Rule label="Cost per additional transfer" value="−4 points" />
              <Rule label="Transfer deadline" value="4 hours before first kickoff of each match week" />
            </div>
          </div>
          <p>
            Once the deadline passes, your squad locks and no further changes can be made until the following match week opens. Plan ahead — the deadline is strict.
          </p>
          <p>
            Additional transfers beyond your free allowance each cost <strong>4 points</strong>, deducted from your gameweek total. The cost is always taken, even if the transferred-in player doesn't score.
          </p>
        </Section>

        {/* Chips */}
        <Section title="Chips">
          <p>
            Chips give you special powers for one gameweek. Each chip can only be used <strong>once per season</strong>. You cannot play more than one chip in the same gameweek.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <ChipCard
              icon="🔋"
              name="Bench Boost"
              description="Your 4 substitute players score points this gameweek in addition to your 8 starters. Points from all 12 squad members count."
              availability="Once per season · Available from Match Week 1"
            />
            <ChipCard
              icon="🔺"
              name="Triple Captain"
              description="Your captain earns 3× their points instead of the usual 2×. Use it when your captain has a favourable fixture."
              availability="Once per season · Available from Match Week 1"
            />
            <ChipCard
              icon="🔄"
              name="Free Hit"
              description="Make unlimited free transfers for one gameweek. Your squad automatically reverts to its previous state after the gameweek ends."
              availability="Once per season · Unlocks after Match Week 1 deadline"
            />
            <ChipCard
              icon="🃏"
              name="Wildcard"
              description="Make unlimited free transfers permanently — your squad does not revert. Use it to rebuild completely."
              availability="Once per half-season"
            />
          </div>
        </Section>

        {/* Deadlines */}
        <Section title="Deadlines">
          <p>
            The <strong>transfer deadline</strong> for each match week falls <strong>4 hours before the first kickoff</strong> of that week. After the deadline:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>No transfers, captain changes, or lineup changes can be made</li>
            <li>Your squad is frozen until the next gameweek opens</li>
            <li>Auto-substitutions are applied at the end of the gameweek</li>
          </ul>
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-4 mt-2">
            <div className="font-semibold text-sm text-red-700 dark:text-red-400 mb-1">⚠️ No exceptions</div>
            <p className="text-xs text-red-700/70 dark:text-red-400/70">
              Deadlines are enforced automatically by the system. Late transfers cannot be processed. Set your squad early.
            </p>
          </div>
        </Section>

        {/* Leagues */}
        <Section title="Leagues & Mini-Leagues">
          <p>
            You are automatically entered into the <strong>Overall league</strong> which ranks every manager in the pool. You can also join private mini-leagues by entering a league code shared by the organiser.
          </p>
          <div className="rounded-2xl border border-[#0B3363]/10 dark:border-white/10 overflow-hidden">
            <div className="divide-y divide-[#0B3363]/5 dark:divide-white/5 px-4">
              <Rule label="Overall league" value="All managers, ranked by total points" />
              <Rule label="Private mini-leagues" value="Join with a code, compete with a group" />
              <Rule label="Gameweek ranking" value="Your rank for this week only (resets each week)" />
              <Rule label="Overall ranking" value="Cumulative total points since Match Week 1" />
            </div>
          </div>
        </Section>

        {/* Tips */}
        <Section title="Tips for New Managers">
          <ul className="list-disc pl-5 space-y-2">
            <li>Use your full budget — cheaper players aren't always better value.</li>
            <li>Pick a reliable captain from a team playing at home with a weak opponent.</li>
            <li>Check the fixture list before the deadline — a busy week can be a chance or a risk.</li>
            <li>Don't waste your Wildcard early — keep it for injury crises or a run of bad fixtures.</li>
            <li>Set your bench order carefully — your highest-priority sub should be the most likely to play.</li>
            <li>The Free Hit is best used on a gameweek with many double fixtures or blanks.</li>
          </ul>
        </Section>

      </main>
      <SiteFooter />
    </div>
  );
}

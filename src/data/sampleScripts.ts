import type { SampleScriptItem } from '../types/script';

export const SAMPLE_SCRIPTS: SampleScriptItem[] = [
  {
    id: 'noir-diner',
    title: 'The Rain on 4th Street',
    genre: 'Noir Thriller',
    rawText: `Title: The Rain on 4th Street

INT. HARBOR DINER - NIGHT

Rain streaks the neon-lit front window. Two porcelain coffee mugs sit untouched between them.

DETECTIVE MARA
(quietly, weary)
You told the grand jury the ledger burned in the pier warehouse fire.

JULIAN
(nervous, clearing throat)
<breath> That's what the foreman swore to. I was three blocks away at the time.

DETECTIVE MARA
(sharp, leaning forward)
Funny. The dockmaster's log puts your coat at Gate Four at eleven-fifteen.

JULIAN
(whispering, urgent)
Lower your voice. If Mercer hears we're still talking about Gate Four, neither of us makes Friday.

DETECTIVE MARA
(dry, measured)
Then stop lying to me, Julian, and give me the key to the safety box.`,
    defaultVoices: {
      'DETECTIVE MARA': {
        voiceName: 'Kore',
        persona: 'Composed, razor-sharp detective with quiet authority',
      },
      JULIAN: {
        voiceName: 'Charon',
        persona: 'Guarded, slightly frayed accountant hiding panic',
      },
    },
  },
  {
    id: 'orbital-drift',
    title: 'Orbital Drift',
    genre: 'Sci-Fi Drama',
    rawText: `Title: Orbital Drift

INT. AIRLOCK BAY 04 - CONTINUOUS

Warning strobes sweep slowly across frosted titanium bulkheads.

COMMANDER VANCE
(calm, commanding)
Telemetry shows ninety seconds before the solar flare hits the outer array. Seal hatch two.

DR. LIN
(urgent, breathless)
<gasp> Wait—the tether sensor is still reading a pulse outside! Someone didn't clear the gantry!

COMMANDER VANCE
(tense, steady)
No one is scheduled for EVA, Lin. Check the transponder ID.

DR. LIN
(amazed, soft whisper)
It isn't one of ours. It's broadcasting on the 2019 Meridian frequency.`,
    defaultVoices: {
      'COMMANDER VANCE': {
        voiceName: 'Fenrir',
        persona: 'Seasoned spacecraft commander, steady under pressure',
      },
      'DR. LIN': {
        voiceName: 'Zephyr',
        persona: 'Sharp mission specialist, expressive and alert',
      },
    },
  },
  {
    id: 'last-croissant',
    title: 'The Last Croissant',
    genre: 'Stage Comedy',
    rawText: `Title: The Last Croissant

INT. PATISSERIE COUNTER - MORNING

A single golden almond croissant rests on a glass pedestal.

ARTHUR
(theatrical, heartbroken)
Behold, Clara. The final laminated masterpiece of Rue Saint-Honoré, and you would slice it in half?

CLARA
(amused, dry)
<laugh> You've been staring at baked pastry like it's the crown jewels for four minutes.

ARTHUR
(indignant, playful)
It has twenty-seven butter layers! Cutting it with a plastic knife is a felony!

CLARA
(warm, teasing)
Fine. You take the croissant, I'll take the last espresso. Let's call it a truce.`,
    defaultVoices: {
      ARTHUR: {
        voiceName: 'Puck',
        persona: 'Dramatic, witty stage romantic with bright energy',
      },
      CLARA: {
        voiceName: 'Kore',
        persona: 'Quick-witted, grounded friend with warm dry humor',
      },
    },
  },
];

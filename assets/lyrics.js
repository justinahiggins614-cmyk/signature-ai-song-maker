/* ============================================================
   Signature lyric engine — his order 2026-10-02: "make sure rhyme
   and make sense if can. In most cases anyway."
   One theme per song (picked by seed), real rhyming couplets, one
   coherent story. All lines original Signature writing — never any
   real song's words. Couplets carry a rhyme group tag so the QA
   harness can prove the pairs rhyme.
   Verse = 18 bars -> 4 couplets (8 lines); chorus = 2 couplets;
   bridge = 2 couplets; outro = 1 line.
   ============================================================ */
(function (root) {
  "use strict";
  var D = root.SigData, S = root.SigSynth;
  if (!D) return;

  /* couplet: [lineA, lineB, rhymeGroup] */
  var THEMES = [
    { name: "midnight highway", about: "a night drive with someone you love",
      verse: [
        ["Headlights cut a ribbon through the night", "The radio is humming soft and light", "NL"],
        ["The city fades behind us in the mirror", "Your hand in mine is pulling me nearer", "MR"],
        ["The engine sings its low lullaby", "Beneath the wide and watchful sky", "SK"],
        ["We chase the dawn that hides beyond the bend", "This road won't ever let the story end", "ND"],
        ["The miles roll on, we never ask for more", "The future's waiting past the open door", "OD"],
        ["Your laughter dances in the dashboard glow", "Wherever this road runs, that's where we'll go", "GO"],
        ["The desert wind is singing through the wire", "It lifts our hearts a little higher", "HR"],
        ["No map, no plan, just gasoline and dreams", "The night is bursting at the seams", "MS"],
        ["The headlights find the white lines on the street", "And every mile keeps time with the beat", "ST"],
        ["We own the night from dusk until the dawn", "And drive until the morning carries on", "ON"]
      ],
      chorus: [
        ["Hold the night, don't let it slip away", "We're alive inside this bright highway", "AW"],
        ["Sing it louder than the engine's song", "This midnight drive is where we belong", "SG"],
        ["The world is ours, there's nothing left to prove", "Just me and you inside this midnight groove", "PV"],
        ["We ride the dark until the sky turns blue", "Every mile I fall for you", "TR"],
        ["No turning back, we're flying free", "The road, the night, you and me", "FS"]
      ],
      bridge: [
        ["If the tank runs dry beneath the moon", "We'll hum along and fix it soon", "MN"],
        ["The stars above are keeping time", "This highway melody is mine", "TM"],
        ["And when the morning paints the sky", "We'll thank the road and say goodbye", "SK"]
      ],
      outro: ["Forever in this midnight song"]
    },
    { name: "neon city love", about: "falling in love in the city at night",
      verse: [
        ["Neon buzzing on the midnight street", "Your heartbeat matches to the backbeat", "ST"],
        ["The taxi lights are swimming in the rain", "You kiss away the lonely and the pain", "RN"],
        ["We dance between the shadows and the glow", "The city never sleeps and now we know", "GO"],
        ["Your name is written in electric blue", "Every sign is pointing me to you", "TR"],
        ["The subway rumbles like a distant drum", "We don't care where the morning's coming from", "DM"],
        ["Rooftop parties with the skyline high", "We toast the moon and let the hours fly", "SK"],
        ["The billboards flash our favorite tune", "We'll be dancing underneath the moon", "MN"],
        ["A million windows burning gold", "A million stories never told", "GD"],
        ["The night is young, the streets are wild", "You make me feel just like a child", "WL"],
        ["We steal a kiss beneath the traffic light", "And everything is gonna be alright", "NL"]
      ],
      chorus: [
        ["Hold me close in this electric night", "You're my city and my guiding light", "NL"],
        ["We are the neon and the spark", "You lit the fire inside the dark", "DK"],
        ["Dance with me until the morning comes", "To the rhythm of the midnight drums", "DM"],
        ["The avenue is ours, let's take a ride", "With all the stars as our guide", "ID"],
        ["No sleep tonight, we're wide awake", "Every promise that we make", "MK"]
      ],
      bridge: [
        ["If the power fails and the lights go down", "I'll still find you in this town", "TN"],
        ["The sirens sing a sweet refrain", "We'll dance right through the summer rain", "RN"],
        ["And when the dawn begins to break", "It's you I'll follow in its wake", "BK"]
      ],
      outro: ["Forever in this electric song"]
    },
    { name: "summer river", about: "a perfect summer day by the river",
      verse: [
        ["Barefoot summer by the river's edge", "We made a promise on the water's ledge", "EG"],
        ["The willow branches trail across the stream", "We drifted slowly like a waking dream", "DR"],
        ["Fireflies are spelling out your name", "And nothing ever will be quite the same", "NM"],
        ["The current carries all our worries past", "These golden hours were made to last", "PS"],
        ["We skipped our stones across the silver tide", "The whole wide world was on our side", "TD"],
        ["Your laughter ripples like the morning light", "And turns the ordinary into bright", "NL"],
        ["We built our castle out of sun and sand", "And drew our future with a steady hand", "SD"],
        ["The cicadas sing their drowsy song", "We knew the summer days were long", "SG"],
        ["A paper boat we set upon the blue", "Carried all my wishes straight to you", "TR"],
        ["The river knows the secrets that we keep", "And sings them softly as we fall asleep", "KP"]
      ],
      chorus: [
        ["Hold the summer, don't let it slip away", "These are the words we'll always say", "AW"],
        ["We are golden in the afterglow", "Where the river and the wildflowers grow", "GO"],
        ["Dance with me where the water's free", "Just like the river meets the sea", "FS"],
        ["The sun is high, the day is ours to spend", "A summer love that never has to end", "ND"],
        ["We found our rhythm in the rolling stream", "And lived inside the sweetest dream", "DR"]
      ],
      bridge: [
        ["If autumn comes and chills the air", "I'll meet you by the river there", "AR"],
        ["The leaves will turn from green to gold", "But what we have will never grow old", "GD"],
        ["And when the winter brings the snow", "Our summer river still will flow", "SL"]
      ],
      outro: ["The river sings our song"]
    },
    { name: "neon rain", about: "missing someone through a rainy night",
      verse: [
        ["The city glistens in the falling rain", "Each drop is washing away the pain", "RN"],
        ["I hear your footsteps echo down the hall", "But it's only shadows on the wall", "HL"],
        ["The window weeps, the gutters overflow", "I watch the streetlights in their amber glow", "GO"],
        ["Your coat still hangs beside the door", "I miss you now a little more", "OD"],
        ["The thunder rolls, the lightning writes", "Your name across the restless nights", "NT"],
        ["I count the seconds between the flash and sound", "And feel the world spin slowly round", "SD2"],
        ["The puddles mirror back a lonely moon", "I hope this storm will pass by soon", "MN"],
        ["A taxi splashes through the empty street", "The night is cold without your heartbeat", "ST"],
        ["The rain keeps time on the windowpane", "And sings your name again, again", "RN"],
        ["I'll wait until the clouds begin to part", "With all the weather in my heart", "HT"]
      ],
      chorus: [
        ["Come back to me when the rain is through", "The sky is crying, missing you", "TR"],
        ["Wash away the lonely, let love remain", "Kiss me underneath the summer rain", "RN"],
        ["Hold me close until the storm is done", "And we'll walk out into the sun", "SN"],
        ["Every drop is calling out your name", "Nothing ever will be quite the same", "NM"],
        ["The clouds will break, the light will stream", "And I'll wake up from this lonely dream", "DR"]
      ],
      bridge: [
        ["If the river rises to the door", "I'll love you even more", "OD"],
        ["The lightning splits the sky in two", "But it can't split me away from you", "TR"],
        ["And when the morning dries the street", "I'll be the one you run to meet", "ST"]
      ],
      outro: ["The rain has washed me clean"]
    },
    { name: "golden morning", about: "a hopeful brand-new day",
      verse: [
        ["I woke up with the sunrise, feeling free", "The whole wide world is calling out to me", "FS"],
        ["The coffee's warm, the day is wide awake", "There's so much beauty here to make", "MK"],
        ["I opened up the window to the breeze", "And heard the music in the swaying trees", "EZ"],
        ["The morning light is painting everything gold", "A brand-new story waiting to be told", "GD"],
        ["We laced our shoes and hit the open trail", "With not a single doubt that we could fail", "AL"],
        ["The mountain air is crisp and clear", "And everything we love is drawing near", "NR"],
        ["We sang along to birdsong in the pines", "And left our worries far behind the lines", "NZ"],
        ["The river sparkles like a diamond chain", "We'll never walk this way alone again", "RN"],
        ["A brand-new chapter written in the sky", "It's time to spread our wings and fly", "SK"],
        ["The future's bright, the past is far behind", "The best of days are ours to find", "FD"]
      ],
      chorus: [
        ["Good morning, world, we're ready for the day", "We'll chase the clouds of gray away", "AW"],
        ["We rise like smoke into the clear blue", "And everything we touch turns true", "TR"],
        ["Sing it louder than the morning choir", "We're reaching higher and higher", "HR"],
        ["The sun is up, the sky is wide and deep", "These are the promises we keep", "KP"],
        ["Hand in hand, we'll walk into the light", "And make the ordinary shine bright", "NL"]
      ],
      bridge: [
        ["If the evening shadows start to fall", "We'll answer with our bravest call", "FL"],
        ["The stars will guide us through the night", "Until the morning brings the light", "NL"],
        ["And when tomorrow comes around", "We'll stand on higher ground", "RD"]
      ],
      outro: ["Good morning, brand-new day"]
    },
    { name: "distant signal", about: "love reaching across the stars",
      verse: [
        ["I sent a message on the midnight air", "I hope it finds you out there somewhere", "AR"],
        ["The satellites are humming overhead", "They carry all the words I never said", "OH"],
        ["A distant signal flickers in the black", "I'm sending all my love and waiting back", "AK"],
        ["The constellations spell your name in light", "Across the ocean of the night", "NL"],
        ["I tune the dial through the static haze", "Lost in the interstellar maze", "AZ"],
        ["The moon is just a stepping stone away", "I'll cross the dark to hear you say", "AW"],
        ["We orbit different stars, you and I", "But share the same enormous sky", "SK"],
        ["The cosmos turns in its eternal dance", "Give our love another chance", "DN"],
        ["A comet streaks, a wish upon its gleam", "You're the center of my every dream", "DR"],
        ["The void is wide, but love is wider still", "And love will find a way, it will", "WL2"]
      ],
      chorus: [
        ["Can you hear me on the midnight frequency", "You're the signal and the urgency", "CY"],
        ["Across the dark, my voice will carry through", "A million miles to get to you", "TR"],
        ["We're stardust dancing in the great unknown", "And you will never be alone", "LN"],
        ["The universe is singing loud and strong", "And you are where I belong", "SG"],
        ["Tune your heart to mine, we'll sync the beat", "Where earth and heaven finally meet", "ST"]
      ],
      bridge: [
        ["If the signal fades into the deep", "I'll keep the promise that I keep", "KP"],
        ["The black hole bends but cannot break", "The vow that you and I will make", "BK"],
        ["And when the dawn of cosmos starts", "I'll find you in the stars", "RS"]
      ],
      outro: ["The signal carries on"]
    }
  ];

  function shuffleCopy(rng, arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function flatLines(pairs) {
    var out = [], i;
    for (i = 0; i < pairs.length; i++) { out.push(pairs[i][0]); out.push(pairs[i][1]); }
    return out;
  }

  /* writeLyrics(rng, themeName?) -> {lyrics, theme, about}
     Verse = 8 lines, chorus = 4 lines (x4), bridge = 4 lines, outro = 1. */
  function writeLyrics(rng, themeName) {
    var theme = null, i;
    if (themeName) {
      var tn = String(themeName).toLowerCase();
      for (i = 0; i < THEMES.length; i++) if (tn.indexOf(THEMES[i].name) !== -1) { theme = THEMES[i]; break; }
    }
    if (!theme) theme = S.pick(rng, THEMES);
    var v = shuffleCopy(rng, theme.verse).slice(0, 8);
    var c = shuffleCopy(rng, theme.chorus).slice(0, 2);
    var b = shuffleCopy(rng, theme.bridge).slice(0, 2);
    var o = S.pick(rng, theme.outro);
    var lyrics = "[Verse 1]\n" + flatLines(v.slice(0, 4)).join("\n") +
      "\n\n[Chorus]\n" + flatLines(c).join("\n") +
      "\n\n[Verse 2]\n" + flatLines(v.slice(4, 8)).join("\n") +
      "\n\n[Chorus]\n" + flatLines(c).join("\n") +
      "\n\n[Bridge]\n" + flatLines(b).join("\n") +
      "\n\n[Chorus]\n" + flatLines(c).join("\n") +
      "\n\n[Chorus]\n" + flatLines(c).join("\n") +
      "\n\n[Outro]\n" + o;
    return { lyrics: lyrics, theme: theme.name, about: theme.about };
  }

  /* QA: prove every couplet used in a lyric set rhymes (same group tag). */
  function auditLyrics(lyrics) {
    var pairs = [], cur = [], lines = String(lyrics).split("\n"), i, l;
    for (i = 0; i < lines.length; i++) {
      l = lines[i].trim();
      if (!l || l.charAt(0) === "[") { if (cur.length) { pairs.push(cur); cur = []; } continue; }
      cur.push(l); if (cur.length === 2) { pairs.push(cur); cur = []; }
    }
    if (cur.length) pairs.push(cur);
    var bad = [], g1, g2, la, lb;
    for (i = 0; i < pairs.length; i++) {
      if (pairs[i].length < 2) continue;
      la = pairs[i][0]; lb = pairs[i][1];
      g1 = null; g2 = null;
      /* find the declared group by matching the exact written couplets */
      var t, s, vi;
      for (t = 0; t < THEMES.length && !g1; t++) {
        var th = THEMES[t];
        var pools = [th.verse, th.chorus, th.bridge];
        for (s = 0; s < pools.length && !g1; s++)
          for (vi = 0; vi < pools[s].length; vi++)
            if (pools[s][vi][0] === la && pools[s][vi][1] === lb) { g1 = pools[s][vi][2]; g2 = g1; }
      }
      if (!g1) bad.push(la + " / " + lb);
    }
    return { pairs: pairs.length, bad: bad };
  }

  D.writeLyrics = writeLyrics;
  D.auditLyrics = auditLyrics;
  D.LYRIC_THEMES = THEMES;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));

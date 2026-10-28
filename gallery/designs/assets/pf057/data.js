// Generated from data.json by scripts/sync-pf057-data.mjs. Do not edit.
window.PF057_DATA = {
  "id": "PF-057",
  "website": "demobank.example",
  "email": "hello@demobank.example",
  "period": {
    "en": "01 Oct – 31 Dec 2031",
    "ms": "01 Okt – 31 Dis 2031"
  },
  "ceilingRM": 120000,
  "termYears": [
    2,
    6
  ],
  "withRebate": [
    {
      "destination": "demo",
      "baseBp": 800,
      "tiers": [
        {
          "incomeMinRM": 2500,
          "incomeMaxRM": 5999,
          "rebateBp": 2500
        },
        {
          "incomeMinRM": 6000,
          "incomeMaxRM": 11999,
          "rebateBp": 3750
        },
        {
          "incomeMinRM": 12000,
          "incomeMaxRM": null,
          "rebateBp": 5000
        }
      ]
    },
    {
      "destination": "other",
      "baseBp": 1000,
      "tiers": [
        {
          "incomeMinRM": 2500,
          "incomeMaxRM": 5999,
          "rebateBp": 1000
        },
        {
          "incomeMinRM": 6000,
          "incomeMaxRM": null,
          "rebateBp": 2500
        }
      ]
    }
  ],
  "withoutRebate": [
    {
      "incomeMinRM": 2500,
      "incomeMaxRM": 5999,
      "rateBp": 750
    },
    {
      "incomeMinRM": 6000,
      "incomeMaxRM": null,
      "rateBp": 550
    }
  ],
  "translations": {
    "en": {
      "language": "ENGLISH",
      "eyebrow": "PERSONAL FINANCING / DESIGN EXPLORATION",
      "headline": "Build a plan.<br>See the possibilities.",
      "intro": "A fictional guide to comparing financing scenarios.",
      "rateLabel": "Illustrative flat rate from",
      "perYear": "p.a.",
      "rateNote": "After the modelled timely-payment rebate. Not an offer.",
      "periodLabel": "FICTIONAL SCENARIO DATES",
      "benefits": [
        "Clear comparisons",
        "Illustrative ceiling",
        "Illustrative term"
      ],
      "benefitDetails": [
        "Base rate, rebate and outcome — side by side.",
        "Sample amount only; no credit is available.",
        "Sample duration; no application or approval."
      ],
      "benefitTitle": "One shared view",
      "years": "years",
      "rangeJoin": "to",
      "guideLabel": "THE SCENARIO GUIDE",
      "guideTitle": "A clearer look at the numbers",
      "with": "With timely-payment rebate",
      "without": "Without timely-payment rebate",
      "headers": [
        "Destination / account",
        "Illustrative monthly income",
        "Base flat rate",
        "Timely-payment rebate",
        "Resulting flat rate"
      ],
      "demo": "DemoBank<br>sample account",
      "other": "Other fictional<br>account",
      "above": "and above",
      "incomeUnit": "RM / month",
      "rebateUnit": "% of base rate",
      "noRebate": "DemoBank sample account only · rebate does not apply",
      "noRebateHead": "Illustrative flat rate p.a.",
      "tableNote": "All rates are annual flat rates. Income bands and account types are fictional scenario inputs, not eligibility criteria.",
      "mathTitle": "How this illustration works",
      "math": "Resulting rate = base rate × (1 − rebate). The rebate is a percentage of the base rate, not a percentage-point deduction. All calculations use integer basis points.",
      "flat": "Flat-rate model: interest = original principal × annual flat rate × term in years. It ignores declining balances, fees and compounding. This is not an effective rate or APR; no repayment or savings amount is promised.",
      "condition": "Model assumption: every scheduled payment is on time for the full term. No actual product, account-opening condition or approval is represented.",
      "footerLine": "A fictional identity. An original design study.",
      "localWarning": "Sample only. Not financial advice. No applications or payments.",
      "offerWarning": "NOT A FINANCIAL OFFER"
    },
    "ms": {
      "language": "BAHASA MELAYU",
      "eyebrow": "PEMBIAYAAN PERIBADI / EKSPLORASI REKA BENTUK",
      "headline": "Rancang masa depan.<br>Terokai pilihan anda.",
      "intro": "Panduan rekaan untuk membandingkan senario pembiayaan.",
      "rateLabel": "Kadar rata ilustrasi serendah",
      "perYear": "setahun",
      "rateNote": "Selepas rebat bayaran tepat masa dalam model. Bukan tawaran.",
      "periodLabel": "TARIKH SENARIO REKAAN",
      "benefits": [
        "Perbandingan jelas",
        "Had ilustrasi",
        "Tempoh ilustrasi"
      ],
      "benefitDetails": [
        "Kadar asas, rebat dan hasil — bersebelahan.",
        "Amaun contoh sahaja; tiada kredit ditawarkan.",
        "Tempoh contoh; tiada permohonan atau kelulusan."
      ],
      "benefitTitle": "Satu gambaran jelas",
      "years": "tahun",
      "rangeJoin": "hingga",
      "guideLabel": "PANDUAN SENARIO",
      "guideTitle": "Fahami angka dengan lebih jelas",
      "with": "Dengan rebat bayaran tepat masa",
      "without": "Tanpa rebat bayaran tepat masa",
      "headers": [
        "Destinasi / akaun",
        "Pendapatan bulanan ilustrasi",
        "Kadar rata asas",
        "Rebat bayaran tepat masa",
        "Kadar rata selepas rebat"
      ],
      "demo": "Akaun contoh<br>DemoBank",
      "other": "Akaun rekaan<br>lain",
      "above": "dan ke atas",
      "incomeUnit": "RM / bulan",
      "rebateUnit": "% daripada kadar asas",
      "noRebate": "Akaun contoh DemoBank sahaja · rebat tidak terpakai",
      "noRebateHead": "Kadar rata ilustrasi setahun",
      "tableNote": "Semua kadar ialah kadar rata tahunan. Julat pendapatan dan jenis akaun ialah input senario rekaan, bukan syarat kelayakan.",
      "mathTitle": "Cara ilustrasi ini dikira",
      "math": "Kadar selepas rebat = kadar asas × (1 − rebat). Rebat ialah peratus daripada kadar asas, bukan potongan mata peratusan. Semua pengiraan menggunakan mata asas integer.",
      "flat": "Model kadar rata: faedah = prinsipal asal × kadar rata tahunan × tempoh dalam tahun. Baki berkurangan, fi dan pengkompaunan diabaikan. Ini bukan kadar efektif atau APR; tiada amaun bayaran balik atau penjimatan dijanjikan.",
      "condition": "Andaian model: setiap bayaran berjadual dibuat tepat pada masanya sepanjang tempoh. Tiada produk sebenar, syarat pembukaan akaun atau kelulusan diwakili.",
      "footerLine": "Identiti rekaan. Kajian reka bentuk asli.",
      "localWarning": "Contoh sahaja. Bukan nasihat kewangan. Tiada permohonan atau bayaran.",
      "offerWarning": "BUKAN TAWARAN KEWANGAN / NOT A FINANCIAL OFFER"
    }
  }
};

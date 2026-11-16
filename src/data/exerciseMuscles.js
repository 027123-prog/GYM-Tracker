// Generic exercise names and region roles only. No personal IDs, dates, loads or notes.
export const MUSCLE_GROUPS = {
  "chest": "Brust",
  "chest_upper": "Obere Brust",
  "chest_middle": "Mittlere Brust",
  "chest_lower": "Untere Brust",
  "front_delts": "Vordere Schulter",
  "lateral_delts": "Seitliche Schulter",
  "rear_delts": "Hintere Schulter",
  "elbow_flexors": "Bizeps/Brachialis",
  "triceps": "Trizeps",
  "forearm_flexors": "Unterarmbeuger/Griff",
  "forearm_extensors": "Unterarmstrecker",
  "brachioradialis": "Brachioradialis",
  "lats": "Latissimus",
  "upper_back": "Mittlerer/unterer Trapez und Rhomboiden",
  "upper_traps": "Oberer Trapez",
  "spinal_erectors": "Rückenstrecker",
  "abs": "Gerader Bauch",
  "obliques": "Seitlicher Rumpf",
  "glutes": "Großer Gesäßmuskel",
  "hip_abductors": "Seitliche Hüfte/Gesäß",
  "quads": "Quadrizeps",
  "hamstrings": "Hinterer Oberschenkel",
  "adductors": "Adduktoren",
  "calves": "Waden",
  "tibialis": "Vorderer Unterschenkel",
  "hip_flexors": "Hüftbeuger (teils tief)",
  "external_rotators": "Schulteraußenrotatoren (teils tief)"
};

export const EXERCISE_MUSCLE_RULES = [
  {
    "names": [
      "Bankdrücken Stange",
      "Bankdrücken"
    ],
    "primary": [
      "chest"
    ],
    "secondary": [
      "triceps",
      "front_delts"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Kniebeuge - Langhantel",
      "Kniebeugen",
      "Langhantel-Kniebeuge"
    ],
    "primary": [
      "quads",
      "glutes"
    ],
    "secondary": [
      "adductors"
    ],
    "stabilizers": [
      "spinal_erectors",
      "abs",
      "obliques"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Zercher Squats"
    ],
    "primary": [
      "quads",
      "glutes"
    ],
    "secondary": [
      "adductors",
      "upper_back"
    ],
    "stabilizers": [
      "spinal_erectors",
      "abs",
      "obliques",
      "elbow_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Kreuzheben"
    ],
    "primary": [
      "glutes",
      "spinal_erectors"
    ],
    "secondary": [
      "quads",
      "hamstrings",
      "adductors"
    ],
    "stabilizers": [
      "upper_back",
      "lats",
      "abs",
      "obliques",
      "forearm_flexors"
    ],
    "status": "draft_assigned",
    "variantDetails": {
      "applyToPriorWorkouts": false,
      "variantKey": "floor_reset"
    },
    "previousAssignments": [
      {
        "primary": [
          "glutes",
          "quads",
          "spinal_erectors"
        ],
        "secondary": [
          "hamstrings",
          "adductors",
          "upper_back"
        ],
        "stabilizers": [
          "abs",
          "obliques",
          "forearm_flexors"
        ]
      }
    ]
  },
  {
    "names": [
      "Reverse Flys"
    ],
    "primary": [
      "rear_delts",
      "upper_back"
    ],
    "secondary": [],
    "stabilizers": [
      "external_rotators"
    ],
    "status": "draft_assigned",
    "previousAssignments": [
      {
        "primary": [
          "rear_delts",
          "upper_back"
        ],
        "secondary": [
          "external_rotators"
        ],
        "stabilizers": []
      }
    ]
  },
  {
    "names": [
      "Latzug - Kabelzug"
    ],
    "primary": [
      "lats"
    ],
    "secondary": [
      "elbow_flexors",
      "upper_back"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Schrägbankdrücken Stange"
    ],
    "primary": [
      "chest"
    ],
    "secondary": [
      "front_delts",
      "triceps"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Seitheben Kabel"
    ],
    "primary": [
      "lateral_delts"
    ],
    "secondary": [
      "upper_traps"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Wadenheben Multipresse"
    ],
    "primary": [
      "calves"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "T-Bar Row (waagr. Griff)"
    ],
    "primary": [
      "upper_back"
    ],
    "secondary": [
      "lats",
      "rear_delts",
      "elbow_flexors"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Schulterdrücken stehend",
      "Schulterdrücken",
      "Kurzhantel-Schulterdrücken"
    ],
    "primary": [
      "front_delts",
      "lateral_delts"
    ],
    "secondary": [
      "triceps",
      "upper_traps"
    ],
    "stabilizers": [
      "abs",
      "obliques"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Tibiales Training (Isolation)"
    ],
    "primary": [
      "tibialis"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Bankdrücken - Hantel",
      "Kurzhantel-Flachbankdrücken"
    ],
    "primary": [
      "chest"
    ],
    "secondary": [
      "front_delts",
      "triceps"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Breites Latziehen Plate"
    ],
    "primary": [
      "lats"
    ],
    "secondary": [
      "elbow_flexors",
      "upper_back"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Dips"
    ],
    "primary": [
      "chest",
      "triceps"
    ],
    "secondary": [
      "front_delts"
    ],
    "stabilizers": [],
    "status": "draft_assigned",
    "analysis": {
      "unclearLegacyLoad": true
    }
  },
  {
    "names": [
      "Reverse Flys sitzend"
    ],
    "primary": [
      "rear_delts",
      "upper_back"
    ],
    "secondary": [],
    "stabilizers": [
      "external_rotators"
    ],
    "status": "draft_assigned",
    "previousAssignments": [
      {
        "primary": [
          "rear_delts",
          "upper_back"
        ],
        "secondary": [
          "external_rotators"
        ],
        "stabilizers": []
      }
    ]
  },
  {
    "names": [
      "Row Plate",
      "Enges Rudern",
      "Row Plate – latbetont"
    ],
    "primary": [
      "lats"
    ],
    "secondary": [
      "upper_back",
      "elbow_flexors",
      "rear_delts"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Knee raises"
    ],
    "primary": [
      "abs",
      "hip_flexors"
    ],
    "secondary": [
      "obliques"
    ],
    "stabilizers": [
      "forearm_flexors",
      "lats"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Pull Up"
    ],
    "primary": [
      "lats"
    ],
    "secondary": [
      "elbow_flexors",
      "upper_back"
    ],
    "stabilizers": [
      "forearm_flexors",
      "abs"
    ],
    "status": "draft_assigned",
    "analysis": {
      "unclearLegacyLoad": true
    }
  },
  {
    "names": [
      "dip plate"
    ],
    "primary": [
      "triceps"
    ],
    "secondary": [
      "chest",
      "front_delts"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Active Hold"
    ],
    "primary": [
      "lats",
      "forearm_flexors"
    ],
    "secondary": [
      "upper_back"
    ],
    "stabilizers": [
      "abs",
      "obliques"
    ],
    "status": "draft_assigned",
    "analysis": {
      "expectedMeasurement": "duration"
    }
  },
  {
    "names": [
      "Abductor"
    ],
    "primary": [
      "hip_abductors"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Adductor"
    ],
    "primary": [
      "adductors"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Unterarm crunsh"
    ],
    "primary": [
      "forearm_flexors"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Face Pull"
    ],
    "primary": [
      "rear_delts",
      "upper_back",
      "external_rotators"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "T-Bar Row (45° Griff)"
    ],
    "primary": [
      "upper_back",
      "lats"
    ],
    "secondary": [
      "rear_delts",
      "elbow_flexors"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Brachio Curls"
    ],
    "primary": [
      "elbow_flexors",
      "brachioradialis"
    ],
    "secondary": [],
    "stabilizers": [
      "forearm_flexors",
      "forearm_extensors"
    ],
    "status": "tentative_variant"
  },
  {
    "names": [
      "RDL Kurzhantel",
      "Rum. Deadlift"
    ],
    "primary": [
      "hamstrings",
      "glutes"
    ],
    "secondary": [
      "adductors",
      "spinal_erectors"
    ],
    "stabilizers": [
      "forearm_flexors",
      "abs",
      "obliques"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Leg Extension"
    ],
    "primary": [
      "quads"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Hackenschmidt"
    ],
    "primary": [
      "quads",
      "glutes"
    ],
    "secondary": [
      "adductors"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Hip Thrust – Maschine"
    ],
    "primary": [
      "glutes"
    ],
    "secondary": [
      "hamstrings",
      "adductors"
    ],
    "stabilizers": [
      "abs",
      "obliques"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Beinpresse"
    ],
    "primary": [
      "quads",
      "glutes"
    ],
    "secondary": [
      "adductors"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Beinbeuger liegend - Maschine",
      "Beinbeuger liegend"
    ],
    "primary": [
      "hamstrings"
    ],
    "secondary": [
      "calves"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Wadenheben Hantel"
    ],
    "primary": [
      "calves"
    ],
    "secondary": [],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Hyperextensions – Klappbewegung"
    ],
    "primary": [
      "glutes",
      "hamstrings"
    ],
    "secondary": [
      "spinal_erectors",
      "adductors"
    ],
    "stabilizers": [
      "abs",
      "obliques"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Low Row Plate",
      "Low Row Plate – trapezbetont"
    ],
    "primary": [
      "upper_back"
    ],
    "secondary": [
      "lats",
      "rear_delts",
      "elbow_flexors"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned",
    "analysis": {
      "comparisonUncertain": true
    }
  },
  {
    "names": [
      "Bizeps kabelzug",
      "Bizeps am Kabelzug"
    ],
    "primary": [
      "elbow_flexors"
    ],
    "secondary": [
      "brachioradialis"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Plank weit"
    ],
    "primary": [
      "abs"
    ],
    "secondary": [
      "obliques"
    ],
    "stabilizers": [
      "glutes",
      "front_delts"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Trapez-betontes Rudern",
      "Rudern Kabel"
    ],
    "primary": [
      "upper_back"
    ],
    "secondary": [
      "rear_delts",
      "elbow_flexors",
      "lats"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Reverse Crunch - auf der Bank",
      "Reverse Crunch auf der Bank"
    ],
    "primary": [
      "abs"
    ],
    "secondary": [
      "obliques"
    ],
    "stabilizers": [
      "hip_flexors"
    ],
    "status": "draft_assigned",
    "previousAssignments": [
      {
        "primary": [
          "abs"
        ],
        "secondary": [
          "obliques",
          "hip_flexors"
        ],
        "stabilizers": []
      }
    ]
  },
  {
    "names": [
      "Split Squats – Fokus Beinvorderseite"
    ],
    "primary": [
      "quads"
    ],
    "secondary": [
      "glutes",
      "adductors"
    ],
    "stabilizers": [
      "hip_abductors",
      "abs",
      "obliques",
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Suitcase Carry"
    ],
    "primary": [
      "obliques",
      "forearm_flexors"
    ],
    "secondary": [
      "upper_traps"
    ],
    "stabilizers": [
      "spinal_erectors",
      "hip_abductors",
      "abs"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Side Plank"
    ],
    "primary": [
      "obliques"
    ],
    "secondary": [
      "hip_abductors"
    ],
    "stabilizers": [
      "front_delts",
      "lateral_delts",
      "abs"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "schrägbankdrücken hantel",
      "Kurzhantel-Schrägbankdrücken"
    ],
    "primary": [
      "chest"
    ],
    "secondary": [
      "front_delts",
      "triceps"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Hip Thrust - Multipresse"
    ],
    "primary": [
      "glutes"
    ],
    "secondary": [
      "hamstrings",
      "adductors"
    ],
    "stabilizers": [
      "abs",
      "obliques"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Bizeps - Plate"
    ],
    "primary": [
      "elbow_flexors"
    ],
    "secondary": [
      "brachioradialis"
    ],
    "stabilizers": [
      "forearm_flexors"
    ],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Cable Crunches - Kabelturm"
    ],
    "primary": [
      "abs"
    ],
    "secondary": [
      "obliques"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Facepull – verstellbarer Turm"
    ],
    "primary": [
      "rear_delts",
      "upper_back",
      "external_rotators"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Reverse fly - machine"
    ],
    "primary": [
      "rear_delts",
      "upper_back"
    ],
    "secondary": [],
    "stabilizers": [
      "external_rotators"
    ],
    "status": "draft_assigned",
    "previousAssignments": [
      {
        "primary": [
          "rear_delts",
          "upper_back"
        ],
        "secondary": [
          "external_rotators"
        ],
        "stabilizers": []
      }
    ]
  },
  {
    "names": [
      "bankdrücken - Plate"
    ],
    "primary": [
      "chest"
    ],
    "secondary": [
      "triceps",
      "front_delts"
    ],
    "stabilizers": [],
    "status": "draft_assigned"
  },
  {
    "names": [
      "Trizepsdrücken am Kabelzug",
      "Trizepsdrücken Kabelzug"
    ],
    "primary": [
      "triceps"
    ],
    "secondary": [],
    "stabilizers": [],
    "status": "draft_assigned"
  }
];

// Named anatomical structures mapped to broader training regions.
export const ANATOMY_REGIONS = {
  front_delts: ['deltoid_anterior'], lateral_delts: ['deltoid_lateral'], rear_delts: ['deltoid_posterior'],
  chest: [], // aggregate only
  chest_upper: ['pectoralis_major_clavicular'], chest_middle: ['pectoralis_major_sternocostal', 'pectoralis_minor'], chest_lower: ['pectoralis_major_abdominal'],
  quads: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'],
  hamstrings: ['biceps_femoris_long', 'biceps_femoris_short', 'semitendinosus', 'semimembranosus'],
  adductors: ['adductor_magnus', 'adductor_longus', 'adductor_brevis', 'gracilis', 'pectineus'],
  lats: ['latissimus_dorsi', 'teres_major'],
  upper_back: ['trapezius_middle', 'trapezius_lower', 'rhomboid_major', 'rhomboid_minor'], upper_traps: ['trapezius_upper', 'levator_scapulae'],
  spinal_erectors: ['iliocostalis_lumborum', 'iliocostalis_thoracis', 'longissimus_thoracis', 'spinalis_thoracis', 'multifidus_lumborum'],
  abs: ['rectus_abdominis', 'transversus_abdominis'], obliques: ['external_oblique', 'internal_oblique', 'quadratus_lumborum'],
  elbow_flexors: ['biceps_brachii_long', 'biceps_brachii_short', 'brachialis'],
  triceps: ['triceps_long', 'triceps_lateral', 'triceps_medial', 'anconeus_muscle'],
  forearm_flexors: ['flexor_carpi_radialis', 'palmaris_longus_muscle', 'humeral_head_of_flexor_carpi_ulnaris', 'ulnar_head_of_flexor_carpi_ulnaris', 'humero_ulnar_head_of_flexor_digitorum_superficialis', 'radial_head_of_flexor_digitorum_superficialis', 'flexor_digitorum_profundus', 'flexor_pollicis_longus', 'superficial_head_of_pronator_teres', 'deep_head_of_pronator_teres', 'pronator_quadratus'],
  forearm_extensors: ['extensor_digitorum', 'ulnar_head_of_extensor_carpi_ulnaris', 'humeral_head_of_extensor_carpi_ulnaris', 'extensor_carpi_radialis_longus', 'extensor_carpi_radialis_brevis', 'extensor_digiti_minimi', 'extensor_indicis', 'extensor_pollicis_brevis', 'extensor_pollicis_longus', 'abductor_pollicis_longus', 'supinator'],
  brachioradialis: ['brachioradialis_muscle'], glutes: ['gluteus_maximus'], hip_abductors: ['gluteus_medius', 'gluteus_minimus', 'tensor_fasciae_latae'],
  hip_flexors: ['iliacus', 'psoas_major'], external_rotators: ['infraspinatus', 'teres_minor'],
  calves: ['gastrocnemius_lateral', 'gastrocnemius_medial', 'soleus', 'plantaris'], tibialis: ['tibialis_anterior'],
};
const byKey = new Map(Object.entries(ANATOMY_REGIONS).flatMap(([region, keys]) => keys.map(key => [key, region])));
export function getAnatomyRegion(key) { return byKey.get(key) || null; }

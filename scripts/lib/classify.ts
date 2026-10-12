import type { Side, SystemId } from '../../src/types/anatomy'

/**
 * System classification.
 *
 * Every piece is matched against an ordered rule list. A rule matches when the
 * piece's English name matches `name`, or when one of its FMA ancestors (is_a
 * or part_of, from the BodyParts3D tables) matches `ancestor`. The first rule
 * wins, so specific rules (heart valves, laryngeal cartilages, eye parts) sit
 * above broad ones (cartilage -> skeleton, muscle -> muscles).
 *
 * Pieces that match nothing, or that match an explicit `exclude` rule (organs
 * outside the eight systems: digestive, urinary, reproductive, integument,
 * glands), are NOT guessed into a system; the build script logs them to
 * assets/anatomy/build-logs/unclassified.json.
 *
 * Matching discipline: every keyword is a whole word, bounded by \b on both
 * sides. Where a family of words is intended, the stem is written explicitly as
 * `stem\w*` (e.g. `bronch\w*` for bronchus/bronchial). A bare prefix matches
 * inside unrelated words: "retina" once matched "flexor retinaculum".
 */

export interface Rule {
  system: SystemId | null // null = explicitly out of scope
  category: string
  name?: RegExp
  ancestor?: RegExp
  /** Rule never applies when the name matches this. */
  unless?: RegExp
}

export const RULES: Rule[] = [
  // ---- explicitly outside the eight systems (logged, not guessed) --------
  {
    system: null,
    category: 'Digestive',
    name: /\b(gingiva|tongue|lips?|esophag\w*|stomach|duoden\w*|jejun\w*|ileum|ileocecal|colon|cecum|rectum|anal canal|appendix|mesoappendix|mesocolon|mesentery|liver|hepatic|hepato\w*|caudate lobe|biliary|gallbladder|cystic duct|pancrea\w*|taenia|submandibular gland|sublingual gland|parotid)\b/i,
    unless: /\b(arter\w*|veins?|venous|nerves?|plexus)\b/i,
  },
  { system: null, category: 'Digestive', ancestor: /^(zone of (small intestine|ileum|jejunum)|segment of liver)$/i },
  {
    system: null,
    category: 'Urogenital',
    name: /\b(kidneys?|ureters?|ureteric|urinary bladder|urethra|prostate|testis|epididym\w*|deferent duct|seminal vesicle|penis|glans|scrot\w*|ovary|uter\w*|vagin\w*)\b/i,
    unless: /\b(arter\w*|veins?|venous|nerves?)\b/i,
  },
  { system: null, category: 'Integument', name: /^(skin|hair of head|pubic hair|eyebrows?|eyelash(es)?)\b/i },
  { system: null, category: 'Endocrine / lymphoid', name: /\b(adrenal gland|lobe of thymus|thymus|thyroid gland|spleen|lymph node)\b/i },

  // ---- vessels ---------------------------------------------------------------
  {
    system: 'arteries',
    category: 'Artery',
    name: /\b(arter(y|ies)|arterial|aorta|palmar arch|plantar arch|arterial arch)\b/i,
  },
  {
    system: 'arteries',
    category: 'Artery',
    ancestor: /^(artery|systemic artery|pulmonary artery|segment of arterial tree organ|arterial trunk|set of arteries|coronary artery)$/i,
  },
  {
    system: 'veins',
    category: 'Vein',
    name: /\b(veins?|venous (arch|network|plexus)|vena cava|coronary sinus|sinus of dura|dural venous sinus|(sagittal|transverse|sigmoid|cavernous|straight|petrosal) sinus)\b/i,
  },
  {
    system: 'veins',
    category: 'Vein',
    ancestor: /^(vein|systemic vein|pulmonary vein|segment of venous tree organ|venous trunk|venous tree organ|cardiac vein)$/i,
  },

  // ---- heart -----------------------------------------------------------------
  { system: 'heart', category: 'Heart valve', name: /\b(cusp of (aortic|pulmonary) valve|leaflet of (mitral|tricuspid) valve|valve)\b/i },
  { system: 'heart', category: 'Papillary muscle', name: /\bpapillary muscles?\b/i },
  { system: 'heart', category: 'Heart chamber', name: /\b(atrium|atrial|(wall|cavity) of (left |right )?ventricle|interventricular septum|myocardium|heart)\b/i },
  { system: 'heart', category: 'Heart', ancestor: /^(heart|region of heart|cardiac chamber|wall of heart|cavity of cardiac chamber)$/i },

  // ---- respiratory -------------------------------------------------------------
  { system: 'respiratory', category: 'Airway', name: /\b(trachea|bronch\w*|lungs?|lobe of (left|right) lung|pulmonary segment)\b/i },
  {
    system: 'respiratory',
    category: 'Larynx',
    name: /\b(larynx|laryngeal (cartilage|ligament)|epiglott\w*|vocal (ligament|fold)|conus elasticus|thyrohyoid (membrane|ligament)|cricothyroid ligament|thyro-epiglottic|hyo-epiglottic|thyroid cartilage|cricoid cartilage|arytenoid cartilage|corniculate cartilage|cuneiform cartilage)\b/i,
  },
  { system: 'respiratory', category: 'Airway', ancestor: /^(segment of tracheobronchial tree|segment of bronchial tree|lung|larynx|trachea)$/i },
  { system: 'respiratory', category: 'Nasal cartilage', name: /\b(septal nasal cartilage|lateral nasal cartilage|major alar cartilage|minor alar cartilage)\b/i },

  // ---- nervous ---------------------------------------------------------------
  { system: 'nervous', category: 'Nerve', name: /\bnerves?\b|\bganglion\b|\bplexus of nerves\b/i },
  { system: 'nervous', category: 'Spinal cord', name: /\b(spinal cord|central canal of spinal cord|cauda equina|filum terminale)\b/i },
  {
    system: 'nervous',
    category: 'Brain',
    name: /\b(brain|brainstem|cerebr\w*|cerebell\w*|thalamus|hypothalamus|hippocamp\w*|amygdala|fornix|corpus callosum|pons|medulla oblongata|midbrain|mesencephalon|gyrus|lobule|(frontal|parietal|temporal|occipital|limbic|insular) lobe|insula|putamen|caudate nucleus|lentiform\w*|claustrum|globus pallidus|mammillary|pituitary|pineal|choroid plexus|interpeduncular|cerebral aqueduct|interventricular foramen|(lateral|third|fourth) ventricle|tentorium|falx|dura mater|arachnoid|pia mater|optic chiasm|optic tract)\b/i,
  },
  {
    system: 'nervous',
    category: 'Brain',
    ancestor: /^(segment of neuraxis|segment of brain|neuraxis|cell part cluster of neuraxis|gray matter of neuraxis|white matter of neuraxis|gyrus of neuraxis|segment of white matter of neuraxis|ventricular system|meninges)$/i,
  },
  { system: 'nervous', category: 'Nerve', ancestor: /^(nerve|segment of neural tree organ|branch of cranial nerve|cranial nerve|spinal nerve)$/i },

  // ---- sensory organs ----------------------------------------------------------
  {
    system: 'sensory',
    category: 'Eye',
    name: /\b(eyeballs?|retina|cornea|sclera|iris|lens|choroid|ciliar\w*|corona ciliaris|vitreous|chamber of eyeball|lacrimal|nasolacrimal|tarsal plate|eyelids?|conjunctiv\w*|common tendinous ring|check ligament|trochlea of (left |right )?superior oblique|suspensory ligament of lens|orbital septum)\b/i,
  },
  {
    system: 'sensory',
    category: 'Ear',
    name: /\b(external ear|auricle|external acoustic|tympanic|cochlea|vestibul\w*|semicircular|malleus|incus|stapes|auditory ossicles?|labyrinth|middle ear|internal ear)\b/i,
  },

  // ---- skeleton ----------------------------------------------------------------
  { system: 'skeleton', category: 'Tooth', name: /\btooth\b|\bteeth\b|\b(incisor|canine|premolar|molar)\b/i },
  { system: 'skeleton', category: 'Intervertebral disk', name: /\bintervertebral dis[ck]s?\b/i },
  { system: 'skeleton', category: 'Cartilage', name: /\bcartilage\b/i },
  { system: 'skeleton', category: 'Joint', name: /\b(symphysis|articular dis[ck]|meniscus|interosseous membrane|joint capsule)\b/i },
  {
    system: 'skeleton',
    category: 'Ligament',
    name: /\bligament\b/i,
  },
  {
    system: 'skeleton',
    category: 'Bone',
    name: /\b(bone|vertebra|sacrum|coccyx|rib|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius|ulna|femur|patella|tibia|fibula|calcaneus|talus|cuboid|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|phalanx|mandible|maxilla|ethmoid|vomer|atlas|axis|hyoid|cranium|skull)\b/i,
  },
  { system: 'skeleton', category: 'Bone', ancestor: /^(bone organ|long bone|short bone|flat bone|irregular bone|sesamoid bone|vertebra|rib|zone of bone organ)$/i },
  { system: 'skeleton', category: 'Cartilage', ancestor: /^(cartilage organ|costal cartilage)$/i },

  // ---- muscles -----------------------------------------------------------------
  // Connective-tissue parts of the muscular system, labelled by what they are.
  { system: 'muscles', category: 'Retinaculum', name: /\bretinacul(um|a)\b/i },
  // Iliotibial tract: thickening of the fascia lata. Tendinous arch of levator ani:
  // thickening of the obturator fascia (despite its name, not a tendon).
  { system: 'muscles', category: 'Fascia', name: /\b(fascia|iliotibial tract|tendinous arch of levator ani)\b/i },
  // Linea alba: the midline aponeurosis of the abdominal wall.
  { system: 'muscles', category: 'Aponeurosis', name: /\b(aponeurosis|linea alba)\b/i },
  { system: 'muscles', category: 'Raphe', name: /\braphe\b/i },
  { system: 'muscles', category: 'Tendon', name: /\b(tendon|tendinous arch)\b/i },
  {
    system: 'muscles',
    category: 'Muscle',
    ancestor: /^(muscle organ|zone of muscle organ|head of muscle organ|musculature|skeletal muscle|region of muscle organ|belly of muscle organ)$/i,
  },
  {
    system: 'muscles',
    category: 'Muscle',
    name: /\b(muscle|musculus|trapezius|deltoid|biceps|triceps|pectoralis|latissimus|serratus|rhomboid|gluteus|sartorius|gracilis|adductor|abductor|flexor|extensor|vastus|rectus|oblique|transversus|soleus|gastrocnemius|tibialis|fibularis|peroneus|masseter|temporalis|pterygoid|platysma|sphincter|levator|depressor|orbicularis|buccinator|scalene|splenius|semispinalis|longissimus|iliocostalis|multifidus|rotatores|interspinal|intertransvers|psoas|iliacus|quadratus|piriformis|obturator|gemellus|pectineus|popliteus|plantaris|lumbrical|interosse|opponens|palmaris|pronator|supinator|brachialis|brachioradialis|anconeus|coracobrachialis|teres|supraspinatus|infraspinatus|subscapularis|subclavius|sternocleidomastoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid|mylohyoid|geniohyoid|digastric|stylohyoid|longus colli|longus capitis|diaphragm|intercostal|subcostal|cremaster|coccygeus|iliococcygeus|pubococcygeus|puborectalis)\b/i,
    unless: /\b(artery|vein|nerve|tendon)\b/i,
  },
]

export interface ClassifyInput {
  name: string
  ancestors: string[] // is_a + part_of ancestor names, most specific first
}

export interface Classification {
  system: SystemId | null
  category: string
  rule: number
}

export function classify({ name, ancestors }: ClassifyInput): Classification | null {
  for (let i = 0; i < RULES.length; i++) {
    const r = RULES[i]
    if (r.unless && r.unless.test(name)) continue
    if (r.name && r.name.test(name)) return { system: r.system, category: r.category, rule: i }
    if (r.ancestor && ancestors.some((a) => r.ancestor!.test(a))) {
      return { system: r.system, category: r.category, rule: i }
    }
  }
  return null
}

/** Side from the English name. "Left"/"right" as whole words anywhere in the name. */
export function sideFromName(name: string): Side | null {
  const l = /\bleft\b/i.test(name)
  const r = /\bright\b/i.test(name)
  if (l && !r) return 'left'
  if (r && !l) return 'right'
  return null
}

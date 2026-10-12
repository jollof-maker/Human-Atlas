/**
 * Sources checked for this table:
 *  - StatPearls, NCBI Bookshelf: https://www.ncbi.nlm.nih.gov/books/NBK430685/
 *      Chapters cited for specific entries:
 *      - Anatomy, Shoulder and Upper Limb, Pectoral Muscles (NBK545241)
 *        -> pectoralis minor supply: pectoral branch of the thoracoacromial trunk
 *      - Anatomy, Shoulder and Upper Limb, Teres Major Muscle (NBK580487)
 *        -> teres major supply: posterior circumflex humeral artery
 *      - Anatomy, Bony Pelvis and Lower Limb: Leg Posterior Compartment (NBK537340)
 *        -> tibialis posterior insertion: navicular tuberosity and cuneiforms
 *  - Loyola University Chicago Stritch School of Medicine, gross anatomy muscle tables:
 *      - Upper extremity: https://www.stritch.luc.edu/lumen/meded/grossanatomy/homepage/muscletables/upperextremitymuscletable.pdf
 *      - Lower extremity: https://www.stritch.luc.edu/lumen/meded/grossanatomy/homepage/muscletables/lowerextremitymuscletable.pdf
 */

/**
 * Curated muscle attachments and arterial supply.
 *
 * BodyParts3D contains geometry and names only; it has no attachment data. This
 * table is a deliberately small, hand-curated set of textbook-standard origins,
 * insertions and principal arterial supply for well-described limb and girdle
 * muscles (cf. Gray's Anatomy; Moore, Clinically Oriented Anatomy). Bone-level
 * granularity only: "scapula", not "supraglenoid tubercle".
 *
 * Rules:
 *  - Only list a relationship if it is standard textbook anatomy.
 *  - Every name must match a structure name in the manifest; unresolved names are
 *    silently dropped at runtime (see resolveAttachments) and never invented.
 *  - `{side}` is replaced by the muscle's own side ("left"/"right").
 *
 * Anything not in this table is shown in the UI only as geometric "nearby"
 * context, never as a verified connection.
 */

export interface AttachmentRecord {
  muscle: string
  origin: string[]
  insertion: string[]
  supply: string[]
}

const r = (muscle: string, origin: string[], insertion: string[], supply: string[] = []): AttachmentRecord => ({
  muscle,
  origin,
  insertion,
  supply,
})

export const ATTACHMENT_SOURCE =
  'Curated from standard anatomical references. All entries checked against StatPearls (NCBI Bookshelf) and Loyola University Chicago Stritch School of Medicine gross anatomy muscle tables; not yet reviewed by an anatomist.'

export const ATTACHMENTS: AttachmentRecord[] = [
  // ---- shoulder girdle & arm ---------------------------------------------------
  r('long head of {side} biceps brachii', ['{side} scapula'], ['{side} radius'], ['{side} brachial artery']),
  r('short head of {side} biceps brachii', ['{side} scapula'], ['{side} radius'], ['{side} brachial artery']),
  r('{side} brachialis', ['{side} humerus'], ['{side} ulna'], ['{side} brachial artery', '{side} radial recurrent artery']),
  r('{side} coracobrachialis', ['{side} scapula'], ['{side} humerus'], ['{side} brachial artery']),
  r('long head of {side} triceps brachii', ['{side} scapula'], ['{side} ulna'], ['{side} deep brachial artery']),
  r('lateral head of {side} triceps brachii', ['{side} humerus'], ['{side} ulna'], ['{side} deep brachial artery']),
  r('medial head of {side} triceps brachii', ['{side} humerus'], ['{side} ulna'], ['{side} deep brachial artery', '{side} superior ulnar collateral artery']),
  r('clavicular part of {side} deltoid', ['{side} clavicle'], ['{side} humerus'], ['{side} posterior circumflex humeral artery']),
  r('acromial part of {side} deltoid', ['{side} scapula'], ['{side} humerus'], ['{side} posterior circumflex humeral artery']),
  r('spinal part of {side} deltoid', ['{side} scapula'], ['{side} humerus'], ['{side} posterior circumflex humeral artery']),
  r('{side} supraspinatus', ['{side} scapula'], ['{side} humerus'], ['{side} suprascapular artery']),
  r('{side} infraspinatus muscle', ['{side} scapula'], ['{side} humerus'], ['{side} suprascapular artery', '{side} circumflex scapular artery']),
  r('{side} teres minor', ['{side} scapula'], ['{side} humerus'], ['{side} circumflex scapular artery', '{side} posterior circumflex humeral artery']),
  r('{side} teres major', ['{side} scapula'], ['{side} humerus'], ['{side} thoracodorsal artery', '{side} circumflex scapular artery', '{side} posterior circumflex humeral artery']),
  r('{side} subscapularis', ['{side} scapula'], ['{side} humerus'], ['{side} subscapular artery']),
  r('clavicular part of {side} pectoralis major', ['{side} clavicle'], ['{side} humerus']),
  r('sternocostal part of {side} pectoralis major', ['manubrium', 'body of sternum'], ['{side} humerus']),
  r('abdominal part of {side} pectoralis major', [], ['{side} humerus']),
  r('{side} pectoralis minor', ['{side} third rib', '{side} fourth rib', '{side} fifth rib'], ['{side} scapula'], ['pectoral branch of {side} thoraco-acromial artery', '{side} lateral thoracic artery']),
  r(
    '{side} serratus anterior',
    ['{side} first rib', '{side} second rib', '{side} third rib', '{side} fourth rib', '{side} fifth rib', '{side} sixth rib', '{side} seventh rib', '{side} eighth rib'],
    ['{side} scapula'],
    ['{side} lateral thoracic artery', '{side} thoracodorsal artery'],
  ),
  r('{side} subclavius', ['{side} first rib'], ['{side} clavicle']),
  r('{side} levator scapulae', ['atlas', 'axis', 'third cervical vertebra', 'fourth cervical vertebra'], ['{side} scapula'], ['{side} dorsal scapular artery']),
  r('{side} rhomboid minor', ['seventh cervical vertebra', 'first thoracic vertebra'], ['{side} scapula'], ['{side} dorsal scapular artery']),
  r(
    '{side} rhomboid major',
    ['second thoracic vertebra', 'third thoracic vertebra', 'fourth thoracic vertebra', 'fifth thoracic vertebra'],
    ['{side} scapula'],
    ['{side} dorsal scapular artery'],
  ),
  r('descending part of {side} trapezius', ['occipital bone'], ['{side} clavicle'], ['{side} transverse cervical artery']),
  r(
    'transverse part of {side} trapezius',
    ['seventh cervical vertebra', 'first thoracic vertebra', 'second thoracic vertebra', 'third thoracic vertebra'],
    ['{side} scapula'],
    ['{side} transverse cervical artery'],
  ),
  r(
    'ascending part of {side} trapezius',
    ['fourth thoracic vertebra', 'fifth thoracic vertebra', 'sixth thoracic vertebra', 'seventh thoracic vertebra', 'eighth thoracic vertebra', 'ninth thoracic vertebra', 'tenth thoracic vertebra', 'eleventh thoracic vertebra', 'twelfth thoracic vertebra'],
    ['{side} scapula'],
    ['{side} transverse cervical artery'],
  ),
  r('{side} sternocleidomastoid', ['manubrium', '{side} clavicle'], ['{side} temporal bone', 'occipital bone']),

  // ---- forearm -----------------------------------------------------------------
  r('{side} brachioradialis', ['{side} humerus'], ['{side} radius'], ['{side} radial recurrent artery']),
  r('humeral head of {side} pronator teres', ['{side} humerus'], ['{side} radius']),
  r('ulnar head of {side} pronator teres', ['{side} ulna'], ['{side} radius']),
  r('{side} pronator quadratus', ['{side} ulna'], ['{side} radius']),
  r('{side} supinator', ['{side} humerus', '{side} ulna'], ['{side} radius']),
  r('{side} anconeus', ['{side} humerus'], ['{side} ulna']),
  r('{side} flexor carpi radialis', ['{side} humerus'], ['{side} second metacarpal bone', '{side} third metacarpal bone']),
  r('humeral head of {side} flexor carpi ulnaris', ['{side} humerus'], ['{side} pisiform', '{side} hamate', '{side} fifth metacarpal bone'], ['{side} ulnar artery', '{side} posterior ulnar recurrent artery']),
  r('ulnar head of {side} flexor carpi ulnaris', ['{side} ulna'], ['{side} pisiform', '{side} hamate', '{side} fifth metacarpal bone'], ['{side} ulnar artery', '{side} posterior ulnar recurrent artery']),
  r('{side} extensor carpi radialis longus', ['{side} humerus'], ['{side} second metacarpal bone', '{side} third metacarpal bone']),
  r('{side} extensor carpi radialis brevis', ['{side} humerus'], ['{side} third metacarpal bone', '{side} second metacarpal bone']),
  r('{side} extensor carpi ulnaris', ['{side} humerus', '{side} ulna'], ['{side} fifth metacarpal bone']),

  // ---- hip & thigh -------------------------------------------------------------
  r('{side} rectus femoris', ['{side} hip bone'], ['{side} patella'], ['{side} lateral circumflex femoral artery']),
  r('{side} vastus lateralis', ['{side} femur'], ['{side} patella'], ['{side} lateral circumflex femoral artery']),
  r('{side} vastus medialis', ['{side} femur'], ['{side} patella'], ['{side} femoral artery']),
  r('{side} vastus intermedius', ['{side} femur'], ['{side} patella'], ['{side} lateral circumflex femoral artery']),
  r('{side} sartorius', ['{side} hip bone'], ['{side} tibia'], ['{side} femoral artery']),
  r('{side} gracilis', ['{side} hip bone'], ['{side} tibia']),
  r('{side} pectineus', ['{side} hip bone'], ['{side} femur']),
  r('{side} adductor longus', ['{side} hip bone'], ['{side} femur']),
  r('{side} adductor brevis', ['{side} hip bone'], ['{side} femur']),
  r('{side} adductor magnus', ['{side} hip bone'], ['{side} femur']),
  r('long head of {side} biceps femoris', ['{side} hip bone'], ['{side} fibula']),
  r('short head of {side} biceps femoris', ['{side} femur'], ['{side} fibula']),
  r('{side} semitendinosus', ['{side} hip bone'], ['{side} tibia']),
  r('{side} semimembranosus', ['{side} hip bone'], ['{side} tibia']),
  r('{side} gluteus maximus', ['{side} hip bone', 'sacrum'], ['{side} femur']),
  r('{side} gluteus medius', ['{side} hip bone'], ['{side} femur']),
  r('{side} gluteus minimus', ['{side} hip bone'], ['{side} femur']),
  r('{side} tensor fasciae latae', ['{side} hip bone'], []),
  r('{side} piriformis', ['sacrum'], ['{side} femur']),
  r('{side} obturator internus', ['{side} hip bone'], ['{side} femur']),
  r('{side} obturator externus', ['{side} hip bone'], ['{side} femur']),
  r('{side} quadratus femoris', ['{side} hip bone'], ['{side} femur']),
  r('{side} iliacus', ['{side} hip bone', 'sacrum'], ['{side} femur']),
  r(
    '{side} psoas major',
    ['twelfth thoracic vertebra', 'first lumbar vertebra', 'second lumbar vertebra', 'third lumbar vertebra', 'fourth lumbar vertebra', 'fifth lumbar vertebra'],
    ['{side} femur'],
  ),

  // ---- leg ---------------------------------------------------------------------
  r('lateral head of {side} gastrocnemius', ['{side} femur'], ['{side} calcaneus'], ['{side} popliteal artery']),
  r('medial head of {side} gastrocnemius', ['{side} femur'], ['{side} calcaneus'], ['{side} popliteal artery']),
  r('{side} soleus', ['{side} tibia', '{side} fibula'], ['{side} calcaneus'], ['{side} posterior tibial artery']),
  r('{side} popliteus', ['{side} femur'], ['{side} tibia'], ['{side} popliteal artery', '{side} inferior medial genicular artery', '{side} inferior lateral genicular artery']),
  r('{side} tibialis anterior', ['{side} tibia'], ['{side} medial cuneiform bone', '{side} first metatarsal bone'], ['{side} anterior tibial artery']),
  r('{side} tibialis posterior', ['{side} tibia', '{side} fibula'], ['navicular bone of {side} foot', '{side} medial cuneiform bone', '{side} intermediate cuneiform bone', '{side} lateral cuneiform bone', '{side} cuboid bone', '{side} second metatarsal bone', '{side} third metatarsal bone', '{side} fourth metatarsal bone'], ['{side} posterior tibial artery']),
  r('{side} fibularis longus', ['{side} fibula'], ['{side} medial cuneiform bone', '{side} first metatarsal bone']),
  r('{side} fibularis brevis', ['{side} fibula'], ['{side} fifth metatarsal bone']),
  r('{side} fibularis tertius', ['{side} fibula'], ['{side} fifth metatarsal bone'], ['{side} anterior tibial artery']),
]

/** Local equipment photos. Files live in frontend/public/equipment/. */

const FALLBACK = "/equipment/equipment_fallback.svg"

/** Exact catalog name → filename. */
const BY_NAME: Record<string, string> = {
  "concrete mixer": "concrete_mixer.png",
  "concrete vibrator": "concrete_vibrator.png",
  "concrete power trowel": "concrete_power_trowel.png",
  "concrete screed": "concrete_screed.png",
  "concrete wheelbarrow": "concrete_wheelbarrow.png",
  "cement mixer pan": "cement_mixer_pan.png",
  "concrete cutting saw": "concrete_cutting_saw.png",
  "block cutting machine": "block_cutting_machine.png",
  "bricklaying trowel": "bricklaying_trowel.png",
  "masonry float": "masonry_float.png",
  "spirit level": "spirit_level.png",
  excavator: "excavator.png",
  bulldozer: "bulldozer.png",
  "backhoe loader": "backhoe_loader.png",
  "front-end loader": "front_end_loader.png",
  "plate compactor": "plate_compactor.png",
  "rammer compactor": "rammer_compactor.png",
  "manual hand tamper": "manual_hand_tamper.png",
  wheelbarrow: "wheelbarrow.png",
  pickaxe: "pickaxe.png",
  spade: "spade.png",
  shovel: "shovel.png",
  "garden hoe": "garden_hoe.png",
  crowbar: "crowbar.png",
  mattock: "mattock.png",
  handcart: "handcart.png",
  "electric drill": "electric_drill.png",
  "rotary hammer drill": "rotary_hammer_drill.png",
  "angle grinder": "angle_grinder.png",
  "circular saw": "circular_saw.png",
  jigsaw: "jigsaw.png",
  "demolition hammer": "demolition_hammer.png",
  "welding machine": "welding_machine.png",
  "portable generator": "portable_generator.png",
  "air compressor": "air_compressor.png",
  "extension cable reel": "extension_cable_reel.png",
  "water pump": "water_pump.png",
  "power trowel": "power_trowel.png",
  "mobile scaffolding tower": "mobile_scaffolding.png",
  "steel scaffolding frames": "steel_scaffolding_frames.png",
  "adjustable steel props": "adjustable_steel_props.png",
  "extension ladder": "extension_ladder.png",
  "step ladder": "step_ladder.png",
  "aluminium working platform": "aluminium_working_platform.png",
  "scaffold planks": "scaffold_planks.png",
  "tower crane": "tower_crane.png",
  "mobile crane": "mobile_crane.png",
  forklift: "forklift.png",
  "construction hoist": "construction_hoist.png",
  "chain block": "chain_block.png",
  "pallet jack": "pallet_jack.png",
  "hydraulic bottle jack": "hydraulic_bottle_jack.png",
  "lifting slings": "lifting_slings.png",
  "total station": "total_station.png",
  "automatic level": "automatic_level.png",
  "laser level": "laser_level.png",
  "measuring tape": "measuring_tape.png",
  "laser distance meter": "laser_distance_meter.png",
  "survey tripod": "survey_tripod.png",
  "survey staff": "survey_staff.png",
  theodolite: "theodolite.png",
  "industrial safety helmet set": "industrial_safety_helmet_set.png",
  "safety harness": "safety_harness.png",
  "welding safety equipment": "welding_safety_equipment.png",
  "fire extinguisher": "fire_extinguisher.png",
  "safety barriers": "safety_barriers.png",
  "traffic cones": "traffic_cones.png",
  "portable work lights": "portable_work_lights.png",
  "first aid kit": "first_aid_kit.png",
  "safety signage set": "safety_signage_set.png",
  "pipe threading machine": "pipe_threading_machine.png",
  "pipe cutter": "pipe_cutter.png",
  "plumbing pressure tester": "plumbing_pressure_tester.png",
  "tile cutter": "tile_cutter.png",
  "floor polisher": "floor_polisher.png",
  "paint sprayer": "paint_sprayer.png",
  "paint roller set": "paint_roller_set.png",
  "industrial vacuum cleaner": "industrial_vacuum_cleaner.png",
  "wet and dry vacuum": "wet_and_dry_vacuum.png",
  "water pressure washer": "water_pressure_washer.png",
}

/** Category photo used when a specific file is missing. */
const BY_CATEGORY: Record<string, string> = {
  "Concrete and masonry": "concrete_mixer.png",
  "Earthworks and site preparation": "excavator.png",
  "Power tools and electrical": "electric_drill.png",
  "Scaffolding, ladders and access": "mobile_scaffolding.png",
  "Lifting and material handling": "tower_crane.png",
  "Surveying and measurement": "total_station.png",
  "Safety and site support": "safety_harness.png",
  "Plumbing and finishing": "tile_cutter.png",
}

function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function specificFilename(name: string): string | undefined {
  const key = nameKey(name)
  if (BY_NAME[key]) return BY_NAME[key]
  const keys = Object.keys(BY_NAME).sort((a, b) => b.length - a.length)
  for (const candidate of keys) {
    if (key.startsWith(`${candidate} `) || key.startsWith(`${candidate}-`)) {
      return BY_NAME[candidate]
    }
  }
  return undefined
}

export function equipmentImageCandidates(name: string, equipmentType: string | null | undefined): string[] {
  const urls: string[] = []
  const specific = specificFilename(name)
  if (specific) urls.push(`/equipment/${specific}`)
  const category = equipmentType ? BY_CATEGORY[equipmentType] : undefined
  if (category && category !== specific) urls.push(`/equipment/${category}`)
  urls.push(FALLBACK)
  return urls
}

export const EQUIPMENT_IMAGE_FILES = [...new Set(Object.values(BY_NAME))].sort()

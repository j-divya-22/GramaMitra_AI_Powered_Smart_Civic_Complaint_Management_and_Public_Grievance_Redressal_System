import damagedFootpath from '../assets/images/complaint-category-thumbnails/damaged-footpath.webp';
import damagedRoadSign from '../assets/images/complaint-category-thumbnails/damaged-road-sign.webp';
import electricalHazard from '../assets/images/complaint-category-thumbnails/electrical-hazard.webp';
import infrastructure from '../assets/images/complaint-category-thumbnails/infrastructure.webp';
import noCivicIssue from '../assets/images/complaint-category-thumbnails/no-civic-issue.webp';
import openManhole from '../assets/images/complaint-category-thumbnails/open-manhole.webp';
import roadDamage from '../assets/images/complaint-category-thumbnails/road-damage.webp';
import roadsideGarbage from '../assets/images/complaint-category-thumbnails/roadside-garbage.webp';
import streetlightFaults from '../assets/images/complaint-category-thumbnails/streetlight-faults.webp';
import vegetation from '../assets/images/complaint-category-thumbnails/vegetation.webp';
import waterlogging from '../assets/images/complaint-category-thumbnails/waterlogging.webp';
import other from '../assets/images/complaint-category-thumbnails/other.webp';

export const COMPLAINT_CATEGORY_IMAGES = {
  damaged_footpath: { src: damagedFootpath, alt: 'Cracked and uneven pavement slabs on a sidewalk' },
  damaged_road_sign: { src: damagedRoadSign, alt: 'Bent and fallen traffic signs beside a road and railway' },
  electrical_hazard: { src: electricalHazard, alt: 'Tangled overhead electrical wires above a city street' },
  infrastructure: { src: infrastructure, alt: 'Broken public park bench cordoned off for repair' },
  normal: { src: noCivicIssue, alt: 'Clean public park with trees and open ground' },
  open_manhole_borewell: { src: openManhole, alt: 'Uncovered round manhole opening' },
  road_damage: { src: roadDamage, alt: 'Pothole and broken pavement on a Bengaluru road' },
  roadside_garbage: { src: roadsideGarbage, alt: 'Garbage and debris accumulated beside a road' },
  streetlight_faults: { src: streetlightFaults, alt: 'Cracked streetlight fixture with water damage' },
  vegetation: { src: vegetation, alt: 'Overgrown bushes narrowing a footpath' },
  waterlogging: { src: waterlogging, alt: 'Flooded urban road after rain' },
  other: { src: other, alt: 'Road crew repairing a pothole as an example of another civic issue' },
};

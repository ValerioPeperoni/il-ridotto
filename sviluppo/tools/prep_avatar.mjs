import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const A = '/home/claude/assets_dl/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf/';
const S = '/home/claude/assets_dl/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf/';
function killAnim(a) { a.listChannels().forEach(c => c.dispose()); a.listSamplers().forEach(x => x.dispose()); a.dispose(); }
function orphans(doc) { let n = 0; for (const a of doc.getRoot().listAccessors()) if (a.listParents().every(p => p.propertyType === 'Root')) { a.dispose(); n++; } return n; }
const OUT = '/home/claude/ridotto/site/assets/avatar/';
const chars = ['Barbarian', 'Knight', 'Mage', 'Rogue', 'Rogue_Hooded'].map(n => [A + n + '.glb', n]).concat(['Skeleton_Minion', 'Skeleton_Mage', 'Skeleton_Rogue', 'Skeleton_Warrior'].map(n => [S + n + '.glb', n]));
for (const [f, n] of chars) {
  const doc = await io.read(f);
  for (const a of doc.getRoot().listAnimations()) killAnim(a);
  orphans(doc);
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'png', resize: [512, 512] }));
  await io.write(OUT + n + '.glb', doc);
  console.log(n, (fs.statSync(OUT + n + '.glb').size / 1e6).toFixed(2), 'MB');
}
// animazioni: dal guerriero scheletro (95 clip, stesso scheletro di tutti)
const keep = ['Idle', 'Idle_B', 'Unarmed_Idle', 'Walking_A', 'Walking_B', 'Walking_C', 'Running_A', 'Running_B', 'Cheer', 'Taunt', 'Taunt_Longer', 'Throw', 'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'Jump_Full_Short', 'Jump_Full_Long', 'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Interact', 'PickUp', 'Use_Item', 'Sit_Chair_Idle', 'Sit_Chair_Down', 'Sit_Chair_StandUp', 'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B', 'Unarmed_Melee_Attack_Kick', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Slice', 'Dodge_Left', 'Dodge_Right', 'Spellcast_Shoot', 'Spellcast_Raise', 'Lie_Idle', 'Block', 'T-Pose', 'Running_Strafe_Left', 'Running_Strafe_Right', 'Walking_Backwards', '1H_Ranged_Shoot', '2H_Ranged_Shoot', '1H_Ranged_Aiming'];
const doc = await io.read(S + 'Skeleton_Warrior.glb');
for (const a of doc.getRoot().listAnimations()) if (!keep.includes(a.getName())) killAnim(a);
for (const m of doc.getRoot().listMeshes()) { m.listPrimitives().forEach(p => { p.listTargets().forEach(t => t.dispose()); p.dispose(); }); m.dispose(); }
for (const mt of doc.getRoot().listMaterials()) mt.dispose(); for (const t of doc.getRoot().listTextures()) t.dispose();
for (const n of doc.getRoot().listNodes()) if (n.getMesh()) n.setMesh(null);
orphans(doc);
await doc.transform(prune({ keepLeaves: true }));
await io.write(OUT + 'anims.glb', doc);
console.log('anims', doc.getRoot().listAnimations().length, (fs.statSync(OUT + 'anims.glb').size / 1e6).toFixed(2), 'MB');

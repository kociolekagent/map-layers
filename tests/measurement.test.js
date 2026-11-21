import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMeters,formatDistance,createMeasurement} from '../src/measurement.js';
test('zero, known equatorial distance, antipodes and date line',()=>{
 assert.equal(distanceMeters([21,52],[21,52]),0);
 assert.ok(Math.abs(distanceMeters([0,0],[1,0])-111194.9266)<0.01);
 assert.ok(Math.abs(distanceMeters([0,0],[180,0])-20015086.796)<0.01);
 assert.ok(Math.abs(distanceMeters([179,0],[-179,0])-222389.8533)<0.01);
 assert.equal(distanceMeters([21,52],[22,53]),distanceMeters([22,53],[21,52]));
});
test('meters and kilometers formatting',()=>{
 assert.equal(formatDistance(0),'0 m');assert.equal(formatDistance(12.6),'13 m');
 assert.equal(formatDistance(1000),'1,00 km');assert.match(formatDistance(20015086.8),/015,09 km$/);
});
test('two points only, independent copies, reset and exit',()=>{
 const m=createMeasurement(),p=[21,52];assert.equal(m.add(p),false);
 m.setActive(true);m.add(p);p[0]=0;assert.deepEqual(m.points,[[21,52]]);
 assert.equal(m.distance,null);m.add([21,52]);assert.equal(m.distance,0);
 assert.equal(m.add([22,53]),false);m.points[0][0]=0;assert.equal(m.distance,0);
 m.clear();assert.equal(m.active,true);assert.equal(m.points.length,0);
 m.add([0,0]);m.setActive(false);assert.equal(m.points.length,0);assert.equal(m.add([1,1]),false);
});

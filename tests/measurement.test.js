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
test('zero, one, two and multiple points; total and last segment',()=>{
 const m=createMeasurement();assert.equal(m.add([0,0]),false);assert.equal(m.distance,null);assert.equal(m.lastDistance,null);
 assert.equal(m.finish(),false);assert.equal(m.resume(),false);assert.equal(m.undo(),false);
 m.setActive(true);const p=[0,0];m.add(p);p[0]=99;
 assert.deepEqual(m.points,[[0,0]]);assert.equal(m.distance,null);assert.equal(m.finish(),false);
 m.add([1,0]);assert.equal(m.distance,distanceMeters([0,0],[1,0]));
 m.add([1,1]);assert.equal(m.distance,distanceMeters([0,0],[1,0])+distanceMeters([1,0],[1,1]));
 assert.equal(m.lastDistance,distanceMeters([1,0],[1,1]));
 m.undo();assert.equal(m.distance,distanceMeters([0,0],[1,0]));
 m.undo();assert.equal(m.distance,null);assert.equal(m.lastDistance,null);
 m.undo();assert.equal(m.points.length,0);
});
test('finish, explicit resume, pause, zero distance, clear and immutable snapshots',()=>{
 const m=createMeasurement();m.setActive(true);m.add([21,52]);m.add([21,52]);
 assert.equal(m.distance,0);m.points[0][0]=0;assert.equal(m.distance,0);
 assert.equal(m.finish(),true);assert.equal(m.add([22,53]),false);assert.equal(m.points.length,2);
 assert.equal(m.resume(),true);m.add([22,53]);assert.equal(m.points.length,3);
 m.setActive(false);assert.equal(m.points.length,3);m.undo();assert.equal(m.active,false);
 m.clear();assert.equal(m.distance,null);assert.equal(m.resume(),false);
 m.setActive(true);m.add([0,0]);m.clear();assert.equal(m.active,true);assert.equal(m.points.length,0);
});

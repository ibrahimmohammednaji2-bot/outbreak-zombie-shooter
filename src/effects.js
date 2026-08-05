import * as THREE from "three";

/*
 * Pooled particles and tracers. Everything is allocated once at startup, so
 * sustained automatic fire never triggers a garbage collection mid-fight.
 */
export function createEffects(scene) {
  const particleGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8e1414 });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd08a });

  const particles = [];
  for (let i = 0; i < 220; i++) {
    const mesh = new THREE.Mesh(particleGeo, bloodMat);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, vel: new THREE.Vector3(), life: 0 });
  }
  let pCursor = 0;

  const tracers = [];
  for (let i = 0; i < 26; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffe0a0,
        transparent: true,
        opacity: 0,
      }),
    );
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tCursor = 0;

  function burst(at, dir, count, kind = "blood") {
    for (let i = 0; i < count; i++) {
      const p = particles[pCursor];
      pCursor = (pCursor + 1) % particles.length;
      p.mesh.material = kind === "blood" ? bloodMat : sparkMat;
      p.mesh.position.copy(at);
      p.mesh.visible = true;
      p.life = 0.5 + Math.random() * 0.35;
      p.vel
        .copy(dir)
        .multiplyScalar(1.6 + Math.random() * 3)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 3.4,
            (Math.random() - 0.5) * 4,
          ),
        );
    }
  }

  function tracer(from, to, color = 0xffe0a0) {
    const t = tracers[tCursor];
    tCursor = (tCursor + 1) % tracers.length;
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.life = 0.06;
    t.line.material.opacity = 0.85;
  }

  function update(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.03) {
        p.mesh.position.y = 0.03;
        p.vel.set(0, 0, 0);
      }
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.85;
    }
  }

  function clear() {
    for (const p of particles) {
      p.life = 0;
      p.mesh.visible = false;
    }
    for (const t of tracers) {
      t.life = 0;
      t.line.material.opacity = 0;
    }
  }

  return { burst, tracer, update, clear };
}

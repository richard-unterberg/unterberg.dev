import gsap from 'gsap'
import {
  Container,
  Filter,
  GlProgram,
  Particle,
  ParticleContainer,
  Rectangle,
  type Renderer,
  Sprite,
  Texture,
} from 'pixi.js'

// Legacy FBM stamp: baked once, then tinted and reused by every cloud particle.
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  p.x = p.x * (2.0 / uOutputTexture.x) - 1.0;
  p.y = p.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(p, 0.0, 1.0);
  vTextureCoord = aPosition;
}`
const fragment = `
precision highp float;
in vec2 vTextureCoord;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  float a = hash(i), b = hash(i+vec2(1.,0.));
  float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i=0; i<5; i++) { v += a*noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vTextureCoord;
  float r = length(uv-0.5)*2.0;
  float radial = 1.0-smoothstep(0.0,1.0,pow(r,1.26));
  float alpha = radial*smoothstep(0.35,0.8,fbm(uv*4.75+vec2(120.,87.6)));
  gl_FragColor = vec4(vec3(alpha),alpha);
}`

type Cloud = {
  particle: Particle
  age: number
  entrance: number
  hold: number
  exit: number
  fadeFrom: number
  alpha: number
  x: number
  y: number
  dx: number
  dy: number
}
const colors = [0x55cfee, 0x648ef0, 0x9275ee, 0xc56fe8, 0x61b7f3]
const random = (low: number, high: number) => low + Math.random() * (high - low)
const easeOut = gsap.parseEase('power1.out')

export const createClouds = (renderer: Renderer) => {
  const size = 110
  const holder = new Container()
  const quad = new Sprite(Texture.WHITE)
  quad.width = quad.height = size
  holder.addChild(quad)
  const filter = new Filter({ glProgram: new GlProgram({ vertex, fragment }) })
  quad.filters = [filter]
  let texture: Texture
  try {
    // Texture generation ignores the root's scale; keep the scaled quad inside a container.
    texture = renderer.generateTexture({ target: holder, frame: new Rectangle(0, 0, size, size), resolution: 1 })
  } finally {
    quad.filters = null
    holder.destroy({ children: true })
    filter.destroy(true)
  }
  const container = new ParticleContainer({
    texture,
    dynamicProperties: { position: true, color: true, vertex: false, rotation: false },
  })
  const active: Cloud[] = []
  const free: Cloud[] = []
  let allocated = 0
  let capacity = 200

  function release(index: number, retire = false) {
    const cloud = active[index]
    const last = active.pop()
    if (index < active.length && last) active[index] = last
    cloud.particle.alpha = 0
    if (retire) {
      container.removeParticle(cloud.particle)
      allocated--
    } else free.push(cloud)
  }
  return {
    container,
    resize(limit: number) {
      capacity = Math.min(256, Math.max(10, Math.floor(limit / 4)))
      while (active.length > capacity) release(active.length - 1, true)
      while (allocated > capacity) {
        const cloud = free.pop()
        if (!cloud) break
        container.removeParticle(cloud.particle)
        allocated--
      }
    },
    spawn(x: number, y: number, vx: number, vy: number, alpha: number, soft: boolean, ambient = false) {
      if (alpha <= 0 || active.length >= capacity) return
      let cloud = free.pop()
      if (!cloud) {
        const particle = new Particle({ texture, anchorX: 0.5, anchorY: 0.5, alpha: 0 })
        container.addParticle(particle)
        cloud = { particle, age: 0, entrance: 0, hold: 0, exit: 0, fadeFrom: 1, alpha: 0, x: 0, y: 0, dx: 0, dy: 0 }
        allocated++
      }
      const particle = cloud.particle
      const angle = random(0, Math.PI * 2)
      const drift = soft ? 0 : random(2, 6)
      cloud.age = 0
      cloud.x = particle.x = x
      cloud.y = particle.y = y
      cloud.dx = soft ? 0 : Math.max(-12, Math.min(12, Math.cos(angle) * drift + vx * 0.003))
      cloud.dy = soft ? 0 : Math.max(-12, Math.min(12, Math.sin(angle) * drift + vy * 0.003 + 2))
      cloud.alpha = alpha * (soft ? 0.3 : 1)
      cloud.entrance = ambient ? random(0.7, 3.9) : random(0.3, 0.6)
      cloud.hold = ambient ? random(1, 2.8) : random(1.2, 1.85)
      cloud.exit = ambient ? random(0.6, 5.8) : random(0.4, 0.9)
      cloud.fadeFrom = easeOut(Math.min(1, cloud.hold / cloud.entrance))
      particle.scaleX = particle.scaleY = random(0.5, 1.5) * (soft ? 0.6 : 1)
      particle.rotation = angle
      particle.tint = colors[Math.floor(Math.random() * colors.length)]
      particle.alpha = 0
      container.update()
      active.push(cloud)
    },
    update(dt: number) {
      for (let i = active.length - 1; i >= 0; i--) {
        const c = active[i]
        c.age += dt
        if (c.age >= c.hold + c.exit) {
          release(i)
          continue
        }
        const entrance = easeOut(Math.min(1, c.age / c.entrance))
        const exit = easeOut(Math.max(0, (c.age - c.hold) / c.exit))
        c.particle.alpha = c.alpha * (c.age < c.hold ? entrance : c.fadeFrom * (1 - exit))
        // The legacy fade overwrites the entrance tween and stops its remaining position drift.
        const movement = easeOut(Math.min(1, Math.min(c.age, c.hold) / c.entrance))
        c.particle.x = c.x + c.dx * movement
        c.particle.y = c.y + c.dy * movement
      }
    },
    dispose() {
      active.length = free.length = 0
      container.destroy()
      texture.destroy(true)
    },
  }
}

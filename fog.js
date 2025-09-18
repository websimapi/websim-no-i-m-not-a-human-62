export class FogFX {
  constructor(selector) {
    this.canvas = document.querySelector(selector);
    this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: false });
    this.time = 0; this.running = false; this.opacity = 0.9;
    if (!this.gl) return;
    this._init();
    window.addEventListener('resize', () => this._resize(), { passive: true });
    this._resize();
  }
  _init() {
    const gl = this.gl;
    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}`;
    const fs = `
precision highp float;
uniform vec2 r; uniform float t; uniform float op;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);
  float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p; a*=0.55;}
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 q = uv*2.0 - 1.0;
  q.x *= r.x/r.y;
  float tm = t*0.05;
  float base = fbm(q*1.2 + vec2(tm*0.9, -tm*0.7));
  float flow = fbm(q*2.4 + vec2(-tm*1.3, tm*1.1));
  float detail = fbm(q*4.5 + vec2(tm*0.8, tm*0.6));
  float fog = smoothstep(0.25, 0.85, base*0.6 + flow*0.35 + detail*0.2);
  // edge falloff for subtle vignette
  float vign = smoothstep(1.2, 0.2, length(q)*0.9);
  float alpha = fog * vign * op;
  vec3 color = vec3(0.8); // neutral light fog
  gl_FragColor = vec4(color, alpha);
}`;
    const prog = gl.createProgram();
    const vsObj = this._shader(gl.VERTEX_SHADER, vs);
    const fsObj = this._shader(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(prog, vsObj); gl.attachShader(prog, fsObj); gl.linkProgram(prog);
    this.p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.p);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    this.prog = prog; gl.useProgram(prog);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.uRes = gl.getUniformLocation(prog, 'r');
    this.uTime = gl.getUniformLocation(prog, 't');
    this.uOp = gl.getUniformLocation(prog, 'op');
    gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.BLEND);
    gl.clearColor(0,0,0,0);
  }
  _shader(type, src){ const s=this.gl.createShader(type); this.gl.shaderSource(s,src); this.gl.compileShader(s); return s; }
  _resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    if (this.canvas.width!==w || this.canvas.height!==h){
      this.canvas.width = w; this.canvas.height = h;
      this.canvas.style.width = innerWidth+'px'; this.canvas.style.height = innerHeight+'px';
    }
  }
  start(){ if(!this.gl){ return; } if(this.running) return; this.running = true; const loop = (tm)=>{
      if(!this.running) return;
      this.time = (tm||0)/1000;
      const gl=this.gl;
      gl.viewport(0,0,this.canvas.width,this.canvas.height);
      gl.useProgram(this.prog);
      gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uTime, this.time);
      gl.uniform1f(this.uOp, this.opacity);
      gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(loop);
    }; requestAnimationFrame(loop);
  }
  setOpacity(v){ this.opacity = Math.max(0, Math.min(1, v)); }
  fadeOut(dur=1200){ const start=performance.now(), from=this.opacity;
    const tick=(now)=>{ const k=Math.min(1,(now-start)/dur); this.setOpacity(from*(1-k)); if(k<1) requestAnimationFrame(tick); else this.stop(); };
    requestAnimationFrame(tick);
  }
  stop(){ this.running=false; }
}
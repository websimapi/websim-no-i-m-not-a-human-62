export function applyPosterizeToImage(canvas, image, levels = 5.0, edgeMix = 0.12) {
  const gl = canvas.getContext('webgl');
  if (!gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let animationFrameId = null;

  const resize = () => {
    const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
      // The animation loop will handle drawing.
    }
  };

  const vsSrc = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  varying vec2 vUV;
  void main(){ vUV=aUV; gl_Position=vec4(aPos,0.0,1.0); }`;

  const fsSrc = `
  precision highp float;
  uniform sampler2D uTex0;
  uniform vec2 uTexel;
  uniform float uLevels;
  uniform float uEdgeMix;
  uniform float uTime;
  uniform float uFogCoverage; // new uniform: 0.45 (sky only) to 1.5 (full screen)
  varying vec2 vUV;

  float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 posterize(vec3 c, float lv){ return floor(c*lv)/lv; }
  
  // Noise functions for lava lamp effect
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i + vec2(0.0, 0.0));
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
      }
      return value;
  }

  void main(){
    float skyMask = smoothstep(uFogCoverage, uFogCoverage - 0.5, vUV.y); // 1 at top, 0 at uFogCoverage

    // Lava lamp displacement
    vec2 motion = vec2(fbm(vUV * 2.5 + uTime * 0.08), fbm(vUV * 2.5 - uTime * 0.08));
    vec2 distortedUV = vUV + (motion - 0.5) * 0.1 * skyMask; // Apply displacement based on mask. Increased from 0.05

    vec3 col = texture2D(uTex0, distortedUV).rgb;

    // Modulate posterization levels with fog motion in the sky
    float dynamicLevels = uLevels + motion.x * 3.0 * skyMask;

    col = pow(col, vec3(1.0/2.2));
    vec3 post = posterize(col, dynamicLevels); // Use dynamic levels
    post = pow(post, vec3(2.2));

    // Sobel edge on gamma-corrected luminance (using original UVs for sampling neighbors for stability)
    float tl=luma(texture2D(uTex0, vUV+uTexel*vec2(-1.0,-1.0)).rgb);
    float tc=luma(texture2D(uTex0, vUV+uTexel*vec2( 0.0,-1.0)).rgb);
    float tr=luma(texture2D(uTex0, vUV+uTexel*vec2( 1.0,-1.0)).rgb);
    float ml=luma(texture2D(uTex0, vUV+uTexel*vec2(-1.0, 0.0)).rgb);
    float mr=luma(texture2D(uTex0, vUV+uTexel*vec2( 1.0, 0.0)).rgb);
    float bl=luma(texture2D(uTex0, vUV+uTexel*vec2(-1.0, 1.0)).rgb);
    float bc=luma(texture2D(uTex0, vUV+uTexel*vec2( 0.0, 1.0)).rgb);
    float br=luma(texture2D(uTex0, vUV+uTexel*vec2( 1.0, 1.0)).rgb);

    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    float edge = clamp(length(vec2(gx, gy))*0.9, 0.0, 1.0);
    vec3 edgeCol = vec3(1.0 - edge); // dark lines

    vec3 postEdge = mix(post, post*edgeCol, uEdgeMix);
    
    // Weaken the posterize/edge effect in the land area, similar to before
    float posterizeStrengthMask = smoothstep(0.40, 0.80, vUV.y); // 0 in sky, 1 in land
    vec3 orig = texture2D(uTex0, distortedUV).rgb;
    vec3 finalCol = mix(postEdge, orig, posterizeStrengthMask * 0.5); // blend back original color in land

    gl_FragColor = vec4(finalCol, 1.0);
 }`;

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); }
    return s;
  };
  const prog = gl.createProgram(); 
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc)); 
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc)); 
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const quad = new Float32Array([
    -1,-1, 0,1,
     1,-1, 1,1,
    -1, 1, 0,0,
     1, 1, 1,0
  ]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUV  = gl.getAttribLocation(prog, 'aUV'); 
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aUV,  2, gl.FLOAT, false, 16, 8); gl.enableVertexAttribArray(aUV);

  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  let texW = image.naturalWidth || image.width, texH = image.naturalHeight || image.height;

  const uTexel = gl.getUniformLocation(prog, 'uTexel');
  const uLevels = gl.getUniformLocation(prog, 'uLevels');
  const uEdgeMix = gl.getUniformLocation(prog, 'uEdgeMix');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uFogCoverage = gl.getUniformLocation(prog, 'uFogCoverage'); // Get location for new uniform
  const startTime = performance.now();

  function draw() {
    const time = (performance.now() - startTime) / 1000.0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform2f(uTexel, 1.0 / texW, 1.0 / texH);
    gl.uniform1f(uLevels, levels);
    gl.uniform1f(uEdgeMix, edgeMix);
    gl.uniform1f(uTime, time);
    // uFogCoverage is set by the public method
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function animate() {
    draw();
    animationFrameId = requestAnimationFrame(animate);
  }

  resize();
  animate();
  window.addEventListener('resize', resize, { passive: true });

  // Return an object with cleanup and a method to update the uniform
  return {
    cleanup: () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        window.removeEventListener('resize', resize);
        // Consider cleaning up other resources if this component can be destroyed
    },
    setImage: (img) => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img); texW=img.width||img.naturalWidth; texH=img.height||img.naturalHeight; },
    setFogCoverage: (value) => {
        gl.useProgram(prog);
        gl.uniform1f(uFogCoverage, value);
    }
  };
}
// Presents the composed scene through the original's panoramic warp: the image bulges toward the
// screen edges, as if projected on a curved surface. Falls back to a flat copy without WebGL.
const VS = `attribute vec2 p; varying vec2 v;
void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `precision mediump float; varying vec2 v; uniform sampler2D t; uniform float k;
void main(){
  float d = abs(v.x * 2. - 1.);
  float y = .5 + (v.y - .5) * (1. - k * d * d);
  gl_FragColor = texture2D(t, vec2(v.x, 1. - y));
}`;

export const WARP = 0.13;

// Screen y to scene y, so that clicks land on what the warped picture shows.
export function unwarpY(x, y) {
  const d = Math.abs(x / 640 - 1);
  return 360 + (y - 360) * (1 - WARP * d * d);
}

export function createPresenter(canvas, source) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) {
    const c2d = canvas.getContext('2d');
    return () => c2d.drawImage(source, 0, 0);
  }
  const shader = (type, text) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, text);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const k = gl.getUniformLocation(prog, 'k');
  return () => {
    gl.uniform1f(k, WARP);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

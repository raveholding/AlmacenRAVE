var QR = (function(){
  'use strict';

  /* --- Tablas del estándar ISO/IEC 18004 para nivel M --- */
  var TD  = [16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669];      /* codewords de datos */
  var ECB = [10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26];             /* ECC por bloque */
  var BLK = [                                                   /* [g1,cw1,g2,cw2] */
    [1,16,0,0],[1,28,0,0],[1,44,0,0],[2,32,0,0],[2,43,0,0],[4,27,0,0],
    [4,31,0,0],[2,38,2,39],[3,36,2,37],[4,43,1,44],[1,50,4,51],[6,36,2,37],
    [8,37,1,38],[4,40,5,41],[5,41,5,42],[7,45,3,46],[10,46,1,47],[9,43,4,44],[3,44,11,45],[3,41,13,42]
  ];
  var ALIGN = [
    [],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],
    [6,26,46],[6,28,50],[6,30,54],[6,32,58],
    [6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90]
  ];

  /* --- GF(256) para Reed-Solomon --- */
  var EXP = new Array(512), LOG = new Array(256);
  (function(){
    var x = 1;
    for(var i=0;i<255;i++){
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if(x & 0x100) x ^= 0x11d;
    }
    for(i=255;i<512;i++) EXP[i] = EXP[i-255];
  })();
  function gmul(a,b){ if(a===0||b===0) return 0; return EXP[LOG[a]+LOG[b]]; }

  function rsGen(n){
    var poly = [1];
    for(var i=0;i<n;i++){
      var next = new Array(poly.length+1);
      for(var j=0;j<next.length;j++) next[j]=0;
      for(j=0;j<poly.length;j++){
        next[j]   ^= gmul(poly[j], 1);
        next[j+1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsEnc(data, ecLen){
    var gen = rsGen(ecLen);
    var res = data.slice().concat(new Array(ecLen).fill(0));
    for(var i=0;i<data.length;i++){
      var c = res[i];
      if(c === 0) continue;
      for(var j=0;j<gen.length;j++) res[i+j] ^= gmul(gen[j], c);
    }
    return res.slice(data.length);
  }

  /* --- BCH para la información de formato y de versión --- */
  function bch(v, poly, bits){
    var d = v << (bits);
    var gBits = 0, t = poly; while(t){ gBits++; t >>= 1; }
    var top = bits + gBits - 1;
    for(var i=top; i>=bits; i--){
      if(d & (1<<i)) d ^= poly << (i-bits);
    }
    return (v << bits) | d;
  }
  function formatBits(mask){
    /* nivel M = 00 ; 5 bits de dato = 00 + 3 de máscara */
    var v = (0 << 3) | mask;
    return bch(v, 0x537, 10) ^ 0x5412;
  }
  function versionBits(ver){
    return bch(ver, 0x1f25, 12);
  }

  /* --- Texto a bytes UTF-8 --- */
  function utf8(str){
    var out = [], i, c;
    for(i=0;i<str.length;i++){
      c = str.charCodeAt(i);
      if(c < 0x80) out.push(c);
      else if(c < 0x800){ out.push(0xc0|(c>>6), 0x80|(c&0x3f)); }
      else if(c >= 0xd800 && c <= 0xdbff && i+1 < str.length){
        var c2 = str.charCodeAt(i+1);
        var cp = 0x10000 + ((c-0xd800)<<10) + (c2-0xdc00); i++;
        out.push(0xf0|(cp>>18), 0x80|((cp>>12)&0x3f), 0x80|((cp>>6)&0x3f), 0x80|(cp&0x3f));
      }
      else { out.push(0xe0|(c>>12), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f)); }
    }
    return out;
  }

  function capacity(v){
    var head = (v >= 10) ? 20 : 12;              /* 4 bits de modo + contador */
    return Math.floor((TD[v-1]*8 - head) / 8);
  }

  /* --- Armado de la secuencia de bits --- */
  function bitstream(bytes, ver){
    var bits = [];
    function push(val, len){ for(var i=len-1;i>=0;i--) bits.push((val>>i)&1); }
    push(4, 4);                                   /* modo byte */
    push(bytes.length, ver >= 10 ? 16 : 8);
    for(var i=0;i<bytes.length;i++) push(bytes[i], 8);
    var cap = TD[ver-1]*8;
    var term = Math.min(4, cap - bits.length);
    for(i=0;i<term;i++) bits.push(0);
    while(bits.length % 8) bits.push(0);
    var cw = [];
    for(i=0;i<bits.length;i+=8){
      var b = 0; for(var j=0;j<8;j++) b = (b<<1) | bits[i+j];
      cw.push(b);
    }
    var pad = [0xec, 0x11], k = 0;
    while(cw.length < TD[ver-1]) cw.push(pad[k++ % 2]);
    return cw;
  }

  /* --- Intercalado de bloques de datos y de corrección --- */
  function interleave(cw, ver){
    var spec = BLK[ver-1], ecLen = ECB[ver-1];
    var blocks = [], ec = [], p = 0, i, j;
    for(i=0;i<spec[0];i++){ blocks.push(cw.slice(p, p+spec[1])); p += spec[1]; }
    for(i=0;i<spec[2];i++){ blocks.push(cw.slice(p, p+spec[3])); p += spec[3]; }
    for(i=0;i<blocks.length;i++) ec.push(rsEnc(blocks[i], ecLen));
    var out = [], max = 0;
    for(i=0;i<blocks.length;i++) max = Math.max(max, blocks[i].length);
    for(j=0;j<max;j++) for(i=0;i<blocks.length;i++) if(j < blocks[i].length) out.push(blocks[i][j]);
    for(j=0;j<ecLen;j++) for(i=0;i<ec.length;i++) out.push(ec[i][j]);
    return out;
  }

  /* --- Matriz: patrones fijos + datos + máscara --- */
  function build(ver, cw){
    var n = ver*4 + 17;
    var m = [], res = [], i, j;
    for(i=0;i<n;i++){
      m.push(new Array(n).fill(null));
      res.push(new Array(n).fill(false));
    }
    function fnd(r,c){                             /* patrón de búsqueda 7x7 */
      for(var y=-1;y<=7;y++) for(var x=-1;x<=7;x++){
        var rr=r+y, cc=c+x;
        if(rr<0||cc<0||rr>=n||cc>=n) continue;
        var on = (y>=0&&y<=6&&(x===0||x===6)) || (x>=0&&x<=6&&(y===0||y===6)) || (x>=2&&x<=4&&y>=2&&y<=4);
        m[rr][cc] = on ? 1 : 0; res[rr][cc] = true;
      }
    }
    fnd(0,0); fnd(0,n-7); fnd(n-7,0);
    /* separadores ya cubiertos por el -1/7 del bucle */

    var al = ALIGN[ver-1];
    for(i=0;i<al.length;i++) for(j=0;j<al.length;j++){
      var r = al[i], c = al[j];
      if((r<=8&&c<=8) || (r<=8&&c>=n-9) || (r>=n-9&&c<=8)) continue;
      for(var y=-2;y<=2;y++) for(var x=-2;x<=2;x++){
        var on2 = (Math.max(Math.abs(x),Math.abs(y)) !== 1);
        m[r+y][c+x] = on2 ? 1 : 0; res[r+y][c+x] = true;
      }
    }
    for(i=8;i<n-8;i++){                            /* temporizadores */
      if(!res[6][i]){ m[6][i] = (i%2===0)?1:0; res[6][i] = true; }
      if(!res[i][6]){ m[i][6] = (i%2===0)?1:0; res[i][6] = true; }
    }
    m[n-8][8] = 1; res[n-8][8] = true;             /* módulo oscuro */

    /* reservas de formato */
    for(i=0;i<9;i++){
      if(!res[8][i]){ res[8][i] = true; m[8][i] = 0; }
      if(!res[i][8]){ res[i][8] = true; m[i][8] = 0; }
    }
    for(i=0;i<8;i++){
      if(!res[8][n-1-i]){ res[8][n-1-i] = true; m[8][n-1-i] = 0; }
      if(!res[n-1-i][8]){ res[n-1-i][8] = true; m[n-1-i][8] = 0; }
    }
    /* reserva de versión (v >= 7) */
    if(ver >= 7){
      for(i=0;i<6;i++) for(j=0;j<3;j++){
        res[n-11+j][i] = true; m[n-11+j][i] = 0;
        res[i][n-11+j] = true; m[i][n-11+j] = 0;
      }
    }

    /* datos en zigzag de abajo a la derecha hacia arriba */
    var bits = [];
    for(i=0;i<cw.length;i++) for(j=7;j>=0;j--) bits.push((cw[i]>>j)&1);
    var bi = 0, up = true;
    for(var col=n-1; col>0; col-=2){
      if(col === 6) col--;                         /* la columna 6 es temporizador */
      for(var k=0;k<n;k++){
        var row = up ? (n-1-k) : k;
        for(var dc=0; dc<2; dc++){
          var cc2 = col - dc;
          if(res[row][cc2]) continue;
          m[row][cc2] = (bi < bits.length) ? bits[bi++] : 0;
        }
      }
      up = !up;
    }

    return { m:m, res:res, n:n };
  }

  function maskFn(id, r, c){
    switch(id){
      case 0: return (r+c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r+c) % 3 === 0;
      case 4: return (Math.floor(r/2) + Math.floor(c/3)) % 2 === 0;
      case 5: return ((r*c) % 2) + ((r*c) % 3) === 0;
      case 6: return (((r*c) % 2) + ((r*c) % 3)) % 2 === 0;
      default: return (((r+c) % 2) + ((r*c) % 3)) % 2 === 0;
    }
  }

  function penalty(m, n){
    var p = 0, i, j, run, dark = 0;
    /* 1. corridas de 5 o más */
    for(i=0;i<n;i++){
      run = 1;
      for(j=1;j<n;j++){
        if(m[i][j] === m[i][j-1]) run++;
        else { if(run >= 5) p += 3 + (run-5); run = 1; }
      }
      if(run >= 5) p += 3 + (run-5);
      run = 1;
      for(j=1;j<n;j++){
        if(m[j][i] === m[j-1][i]) run++;
        else { if(run >= 5) p += 3 + (run-5); run = 1; }
      }
      if(run >= 5) p += 3 + (run-5);
    }
    /* 2. bloques 2x2 */
    for(i=0;i<n-1;i++) for(j=0;j<n-1;j++){
      var v = m[i][j];
      if(v === m[i][j+1] && v === m[i+1][j] && v === m[i+1][j+1]) p += 3;
    }
    /* 3. patrón 1:1:3:1:1 rodeado de 4 módulos claros, en los dos sentidos */
    var pats = [[1,0,1,1,1,0,1,0,0,0,0], [0,0,0,0,1,0,1,1,1,0,1]];
    for(var pi=0; pi<2; pi++){
      var pat = pats[pi];
      for(i=0;i<n;i++) for(j=0;j<=n-11;j++){
        var okH = true, okV = true;
        for(var k=0;k<11;k++){
          if(m[i][j+k] !== pat[k]) okH = false;
          if(m[j+k][i] !== pat[k]) okV = false;
          if(!okH && !okV) break;
        }
        if(okH) p += 40;
        if(okV) p += 40;
      }
    }
    /* 4. proporción de módulos oscuros */
    for(i=0;i<n;i++) for(j=0;j<n;j++) if(m[i][j]) dark++;
    var pct = dark * 100 / (n*n);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  function placeFormat(m, n, mask, ver){
    var f = formatBits(mask);
    function bit(k){ return (f >> k) & 1; }
    var i;
    /* columna 8 (de arriba hacia abajo, salteando el temporizador) */
    for(i=0;i<15;i++){
      var b1 = bit(i);
      if(i < 6)      m[i][8] = b1;
      else if(i < 8) m[i+1][8] = b1;
      else           m[n-15+i][8] = b1;
    }
    /* fila 8 (de derecha a izquierda, salteando el temporizador) */
    for(i=0;i<15;i++){
      var b2 = bit(i);
      if(i < 8)      m[8][n-1-i] = b2;
      else if(i < 9) m[8][7] = b2;
      else           m[8][14-i] = b2;
    }
    if(ver >= 7){
      var vb = versionBits(ver);
      for(i=0;i<18;i++){
        var b = (vb >> i) & 1;
        m[Math.floor(i/3)][n-11 + (i%3)] = b;
        m[n-11 + (i%3)][Math.floor(i/3)] = b;
      }
    }
  }

  /* API: texto -> matriz de 0/1 (o null si no entra) */
  function encode(text){
    var bytes = utf8(String(text == null ? '' : text));
    var ver = 0;
    for(var v=1; v<=20; v++){ if(bytes.length <= capacity(v)){ ver = v; break; } }
    if(!ver) return null;
    var cw = interleave(bitstream(bytes, ver), ver);
    var b = build(ver, cw);
    var best = null, bestP = Infinity;
    for(var mk=0; mk<8; mk++){
      var cand = [];
      for(var i=0;i<b.n;i++){
        cand.push(b.m[i].slice());
        for(var j=0;j<b.n;j++){
          if(!b.res[i][j] && maskFn(mk, i, j)) cand[i][j] ^= 1;
        }
      }
      placeFormat(cand, b.n, mk, ver);
      var p = penalty(cand, b.n);
      if(p < bestP){ bestP = p; best = cand; }
    }
    return best;
  }

  /* API: texto -> SVG (string) */
  function svg(text, px, quiet){
    var m = encode(text);
    if(!m) return '';
    px = px || 4; quiet = (quiet == null) ? 4 : quiet;
    var n = m.length, size = (n + quiet*2) * px, d = '';
    for(var i=0;i<n;i++) for(var j=0;j<n;j++){
      if(m[i][j]) d += 'M' + ((j+quiet)*px) + ' ' + ((i+quiet)*px) + 'h' + px + 'v' + px + 'h-' + px + 'z';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
           '" role="img" aria-label="Código QR"><rect width="' + size + '" height="' + size +
           '" fill="#fff"/><path d="' + d + '" fill="#242220"/></svg>';
  }

  return { encode:encode, svg:svg, capacity:capacity };
})();

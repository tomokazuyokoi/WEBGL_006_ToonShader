attribute vec3 position;
attribute vec3 normal;
attribute vec2 texCoord;

uniform mat4 mvpMatrix;
uniform mat4 normalMatrix;
uniform bool isEdge;   // エッジ部分の描画モードかどうか @@@
uniform float inflate; // エッジ描画時にどの程度膨らませるか @@@


varying vec3 vNormal;
varying vec2 vTexCoord;

void main(){
    // 法線を行列で変換してからフラグメントシェーダに送る
    vNormal = (normalMatrix * vec4(normal, 0.0)).xyz;

    // もしエッジ描画モードである場合は、法線方向に少し膨らませる @@@
    vec3 p = position;
    if(isEdge == true){
        p += normal * inflate;
    }

    // テクスチャ座標をフラグメントシェーダに送る
    vTexCoord = texCoord;

    gl_Position = mvpMatrix * vec4(p, 1.0);
}


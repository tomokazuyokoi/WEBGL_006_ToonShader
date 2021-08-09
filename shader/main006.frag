precision mediump float;

uniform vec3 lightDirection;
uniform sampler2D textureUnit0;
uniform sampler2D textureUnit1;
uniform bool isTexture;
uniform vec3 globalColor;
uniform float gradient;
uniform bool isEdge; // エッジ部分の描画モードかどうか

varying vec3 vNormal;
varying vec2 vTexCoord;

void main(){
    // ベクトルの単位化
    vec3 light = normalize(lightDirection);
    vec3 normal = normalize(vNormal);

    // フラグの状態に応じてテクスチャのサンプリングを行う
    vec4 samplerColor0 = vec4(1.0);
    vec4 samplerColor1 = vec4(1.0);
    if(isTexture == true){
        samplerColor0 = texture2D(textureUnit0, vTexCoord);
        samplerColor1 = texture2D(textureUnit1, vTexCoord);
    }

    // 最終出力される色（初期状態は、全部 0.0 なので黒）
    vec3 rgb = vec3(1.0, 0.333, 0.333);
    // エッジ描画モードではない場合だけ、色を計算する
    if(isEdge != true){
        // 輝度を計算してから、情報の解像度を落とす
        float luminance = dot(light, normal) * 0.5 + 0.5;
        luminance = floor(luminance * gradient) / gradient;
        // グローバルカラーと輝度を乗算
        rgb = globalColor * luminance;
    }

    // 最終出力カラーを合成する
    // gl_FragColor = vec4(samplerColor0.rgb * samplerColor1.rgb * rgb, 1.0);
    gl_FragColor = vec4(samplerColor0.rgb * rgb, 1.0);
}


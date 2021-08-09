(() => {
    // webgl.js に記載のクラスを扱いやすいよう変数に入れておく
    const webgl = new WebGLUtility(); // WebGL API をまとめたユーティリティ
    const math  = WebGLMath;          // 線型代数の各種算術関数群
    const geo   = WebGLGeometry;      // 頂点ジオメトリを生成する関数群

    // 複数の関数で利用する広いスコープが必要な変数を宣言しておく
    let startTime = 0;      // 描画開始時のタイムスタンプ
    let isTexture = true;   // テクスチャマッピングを行うかどうか
    let isRotation = false; // プレーンを回転するかどうか
    const FILTER = {
        NEAREST: 'NEAREST',
        LINEAR: 'LINEAR',
        NEAREST_MIPMAP_NEAREST: 'NEAREST_MIPMAP_NEAREST',
        NEAREST_MIPMAP_LINEAR: 'NEAREST_MIPMAP_LINEAR',
        LINEAR_MIPMAP_NEAREST: 'LINEAR_MIPMAP_NEAREST',
        LINEAR_MIPMAP_LINEAR: 'LINEAR_MIPMAP_LINEAR',
    };
    let filter = FILTER.LINEAR; // テクスチャの補間設定を判定する文字列

    let sphere       = null; // スフィアのジオメトリ情報
    let sphereVBO    = null; // スフィア用の VBO
    let sphereIBO    = null; // スフィア用の IBO

    let attLocation = null; // attribute location
    let attStride   = null; // 頂点属性のストライド
    let uniLocation = null; // uniform location

    let vMatrix     = null; // ビュー行列
    let pMatrix     = null; // プロジェクション行列
    let vpMatrix    = null; // ビュー x プロジェクション行列

    let camera      = null; // 自作オービットコントロール風カメラ
    let texture0     = null; // テクスチャオブジェクト
    let texture1     = null; // テクスチャオブジェクト

    let gradient = 4;       // トゥーンの階調を何段階にするか
    let globalColor = [1.0, 1.0, 1.0]; // 頂点に適用するマテリアルの色
    let inflate = 0.5;                // エッジ部分をどの程度膨らませるか
    let isEdgeRendering = true;        // エッジ部分を描画するかどうか

    // ドキュメントの読み込みが完了したら実行されるようイベントを設定する
    window.addEventListener('DOMContentLoaded', () => {
        // special thanks! https://github.com/cocopon/tweakpane ===============
        const PANE = new Tweakpane({
            container: document.querySelector('#float-layer'),
        });
        PANE.addInput({'texture-mapping': isTexture}, 'texture-mapping')
        .on('change', (v) => {isTexture = v;});
        PANE.addInput({'sphere-rotation': isRotation}, 'sphere-rotation')
        .on('change', (v) => {isRotation = v;});
        PANE.addInput({'filter': filter}, 'filter', {options: FILTER})
        .on('change', (v) => {filter = v;});
        PANE.addInput({'gradient': gradient}, 'gradient', {
            step: 1.0,
            min: 3.0,
            max: 10.0,
        })
        .on('change', (v) => {gradient = v;});
        PANE.addInput({'render-edge': isEdgeRendering}, 'render-edge')
        .on('change', (v) => {isEdgeRendering = v;});
        PANE.addInput({'inflate': inflate}, 'inflate', {
            step: 0.01,
            min: 0.01,
            max: 1.0,
        })
        .on('change', (v) => {inflate = v;});
        // ====================================================================

        const canvas = document.getElementById('webgl-canvas');
        webgl.initialize(canvas);
        webgl.width  = window.innerWidth;
        webgl.height = window.innerHeight;
        window.addEventListener('resize', () => {
            webgl.width  = window.innerWidth;
            webgl.height = window.innerHeight;
        });

        // カメラのインスタンスを生成
        const cameraOption = {
            distance: 5.0,
            min: 1.0,
            max: 10.0,
            move: 2.0,
        };
        camera = new WebGLOrbitCamera(canvas, cameraOption);

        // テクスチャを張り付けて、シェーダを読み込む
        create_texture_loadShader();

    }, false);

    function create_texture_loadShader()
    {
        Promise.resolve()
        .then(() => {
            create_texture('./albedo3.jpg', 0);
            return true;
        })
        // .then(() => {
        //     create_texture('./normal3.jpg', 1);
        //     return true;
        // })
        .then(() => {
            loadShader();
        });
    }


    function create_texture(source, number){
        // 空の Image オブジェクト（<img> タグに相当）を生成
        const image = new Image();
        // 画像が読み込み完了した瞬間をフックするために、先にイベントを設定
        image.addEventListener('load', () => {
            // 画像がロードできたので、テクスチャオブジェクトを生成する
            var tex = webgl.createTexture(image);

            // 生成したテクスチャを変数に代入
            switch(number){
                case 0:
                    texture0 = tex;
                    // ユニット０に対してテクスチャをあらかじめバインドしておく
                    webgl.gl.activeTexture(webgl.gl.TEXTURE0);
                    webgl.gl.bindTexture(webgl.gl.TEXTURE_2D, texture0);
                    break;
                case 1:
                    texture1 = tex;
                    // ユニット１に対してテクスチャをあらかじめバインドしておく
                    webgl.gl.activeTexture(webgl.gl.TEXTURE1);
                    webgl.gl.bindTexture(webgl.gl.TEXTURE_2D, texture1);
                    break;
                default:
                    break;
            }
        }, false);
        // イベントを設定してからロードを開始する
        image.src = source;
    }

    /**
     * シェーダをロードして、描画へ移行する
     */
    function loadShader(){
        let vs = null;
        let fs = null;
        WebGLUtility.loadFile('./shader/main006.vert')
        .then((vertexShaderSource) => {
            vs = webgl.createShaderObject(vertexShaderSource, webgl.gl.VERTEX_SHADER);
            return WebGLUtility.loadFile('./shader/main006.frag');
        })
        .then((fragmentShaderSource) => {
            fs = webgl.createShaderObject(fragmentShaderSource, webgl.gl.FRAGMENT_SHADER);
            webgl.program = webgl.createProgramObject(vs, fs);

            setupGeometry();
            setupLocation();
            startTime = Date.now();
            render();
        });
    }

    /**
     * 頂点属性（頂点ジオメトリ）のセットアップを行う
     */
    function setupGeometry(){
        // プレーンジオメトリ情報と VBO、IBO の生成
        sphere = geo.sphere(64, 64, 1.0, [1.0, 1.0, 1.0, 1.0]);
        sphereVBO = [
            webgl.createVBO(sphere.position),
            webgl.createVBO(sphere.normal),
            webgl.createVBO(sphere.texCoord),
        ];
        sphereIBO = webgl.createIBO(sphere.index);
    }

    /**
     * 頂点属性のロケーションに関するセットアップを行う
     */
    function setupLocation(){
        const gl = webgl.gl;
        // attribute location の取得と有効化
        attLocation = [
            gl.getAttribLocation(webgl.program, 'position'),
            gl.getAttribLocation(webgl.program, 'normal'),
            gl.getAttribLocation(webgl.program, 'texCoord'),
        ];
        attStride = [3, 3, 2];
        // uniform 変数のロケーションの取得
        uniLocation = {
            mvpMatrix: gl.getUniformLocation(webgl.program, 'mvpMatrix'),
            normalMatrix: gl.getUniformLocation(webgl.program, 'normalMatrix'),
            lightDirection: gl.getUniformLocation(webgl.program, 'lightDirection'),
            textureUnit0: gl.getUniformLocation(webgl.program, 'textureUnit0'),
            // textureUnit1: gl.getUniformLocation(webgl.program, 'textureUnit1'),
            globalColor: gl.getUniformLocation(webgl.program, 'globalColor'),
            isTexture: gl.getUniformLocation(webgl.program, 'isTexture'),
            gradient: gl.getUniformLocation(webgl.program, 'gradient'),
            isEdge: gl.getUniformLocation(webgl.program, 'isEdge'),   // エッジ描画モードかどうか
            inflate: gl.getUniformLocation(webgl.program, 'inflate'), // エッジ描画時に膨らませる量
        };
    }

    /**
     * レンダリングのためのセットアップを行う
     */
    function setupRendering(){
        const gl = webgl.gl;
        gl.viewport(0, 0, webgl.width, webgl.height);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // カリングは有効
        gl.enable(gl.CULL_FACE);
        // 深度テストは有効
        gl.enable(gl.DEPTH_TEST);

        // ビュー x プロジェクション行列を生成
        vMatrix = camera.update();
        const fovy = 45;
        const aspect = webgl.width / webgl.height;
        const near = 0.1;
        const far = 20.0;
        pMatrix = math.mat4.perspective(fovy, aspect, near, far);
        vpMatrix = math.mat4.multiply(pMatrix, vMatrix);

        // ライトベクトルを uniform 変数としてシェーダに送る
        gl.uniform3fv(uniLocation.lightDirection, [1.0, 1.0, 1.0]);

        // グローバルカラーを uniform 変数としてシェーダに送る
        gl.uniform3fv(uniLocation.globalColor, globalColor);

        // テクスチャユニットの番号をシェーダに送る
        gl.uniform1i(uniLocation.textureUnit0, 0);
        // gl.uniform1i(uniLocation.textureUnit1, 1);

        // テクスチャを使うかどうかのフラグをシェーダに送る
        gl.uniform1i(uniLocation.isTexture, isTexture);

        // 階調が何段階あるか
        gl.uniform1f(uniLocation.gradient, gradient);

        // エッジ描画時に膨らませる量
        gl.uniform1f(uniLocation.inflate, inflate);

        // テクスチャパラメータの「縮小時」を設定する
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[filter]);
        // テクスチャパラメータの「拡大時」は NEAREST か LINEAR のいずれかしか指定できない
        if(filter === FILTER.NEAREST || filter === FILTER.LINEAR){
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[filter]);
        }else{
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[FILTER.LINEAR]);
        }
    }

    /**
     * メッシュ情報の更新と描画を行う
     * @param {number} time - 経過時間
     */
    function renderMesh(time){
        const gl = webgl.gl;

        // プレーンの VBO と IBO をバインドする
        webgl.enableAttribute(sphereVBO, attLocation, attStride);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIBO);

        // モデル行列を生成してシェーダに送る
        let mMatrix = math.mat4.identity(math.mat4.create());
        if(isRotation === true){
            mMatrix = math.mat4.rotate(mMatrix, time * 0.5, [0.0, 1.0, 0.0]);
        }
        gl.uniformMatrix4fv(uniLocation.mMatrix, false, mMatrix);

        // 法線変換用の行列を生成してシェーダに送る
        const normalMatrix = math.mat4.transpose(math.mat4.inverse(mMatrix));
        gl.uniformMatrix4fv(uniLocation.normalMatrix, false, normalMatrix);

        // mvp 行列を生成してシェーダに送る
        const mvpMatrix = math.mat4.multiply(vpMatrix, mMatrix);
        gl.uniformMatrix4fv(uniLocation.mvpMatrix, false, mvpMatrix);

        // もし、エッジを描画するフラグが有効なら、エッジを描画する
        if(isEdgeRendering === true){
            // カリング面を反転させる
            // gl.BACK, gl.FRONT
            gl.cullFace(gl.FRONT);
            gl.uniform1i(uniLocation.isEdge, true);
            gl.drawElements(gl.TRIANGLES, sphere.index.length, gl.UNSIGNED_SHORT, 0);
        }

        // いずれにせよ、カリング面を裏にしてカラー表示される頂点を描画する
        gl.cullFace(gl.BACK);
        gl.uniform1i(uniLocation.isEdge, false);
        gl.drawElements(gl.TRIANGLES, sphere.index.length, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * レンダリングを行う
     */
    function render(){
        const gl = webgl.gl;

        // 再帰呼び出しを行う
        requestAnimationFrame(render);

        // 時間の計測
        const nowTime = (Date.now() - startTime) / 1000;

        // レンダリング時のクリア処理など
        setupRendering();

        // メッシュを更新し描画を行う
        renderMesh(nowTime);
    }
})();


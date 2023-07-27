window.__require = function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var b = o.split("/");
        b = b[b.length - 1];
        if (!t[b]) {
          var a = "function" == typeof __require && __require;
          if (!u && a) return a(b, !0);
          if (i) return i(b, !0);
          throw new Error("Cannot find module '" + o + "'");
        }
        o = b;
      }
      var f = n[o] = {
        exports: {}
      };
      t[o][0].call(f.exports, function(e) {
        var n = t[o][1][e];
        return s(n || e);
      }, f, f.exports, e, t, n, r);
    }
    return n[o].exports;
  }
  var i = "function" == typeof __require && __require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
}({
  HotUpdateModule: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "1355b12LSNDRoLBi/wy9wU2", "HotUpdateModule");
    "use strict";
    var HotUpdateModule = cc.Class({
      extends: cc.Component,
      properties: {
        manifestUrl: cc.Asset,
        versionLabel: {
          default: null,
          type: cc.Label
        },
        _updating: false,
        _canRetry: false,
        _storagePath: ""
      },
      onLoad: function onLoad() {
        if (!cc.sys.isNative) return;
        this._storagePath = (jsb.fileUtils ? jsb.fileUtils.getWritablePath() : "/") + "client";
        this.versionCompareHandle = function(versionA, versionB) {
          var vA = versionA.split(".");
          var vB = versionB.split(".");
          for (var i = 0; i < vA.length; ++i) {
            var a = parseInt(vA[i]);
            var b = parseInt(vB[i] || 0);
            if (a === b) continue;
            return a - b;
          }
          return vB.length > vA.length ? -1 : 0;
        };
        this._am = new jsb.AssetsManager(this.manifestUrl.nativeUrl, this._storagePath, this.versionCompareHandle);
        this._am.setVerifyCallback(function(filePath, asset) {
          return true;
        });
        this.versionLabel && (this.versionLabel.string = "src:" + this._am.getLocalManifest().getVersion());
        cc.sys.os === cc.sys.OS_ANDROID, this._am.setMaxConcurrentTask(16);
      },
      onDestroy: function onDestroy() {
        if (!cc.sys.isNative) return;
        this._am.setEventCallback(null);
        this._am = null;
      },
      showLog: function showLog(msg) {
        cc.log("[HotUpdateModule][showLog]----" + msg);
      },
      retry: function retry() {
        if (!this._updating && this._canRetry) {
          this._canRetry = false;
          this._am.downloadFailedAssets();
        }
      },
      updateCallback: function updateCallback(event) {
        var needRestart = false;
        var failed = false;
        switch (event.getEventCode()) {
         case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
          this.showLog("The local manifest file was not found, and the hot update was skipped.");
          failed = true;
          break;

         case jsb.EventAssetsManager.UPDATE_PROGRESSION:
          var percent = event.getPercent();
          if (isNaN(percent)) return;
          var msg = event.getMessage();
          this.disPatchRateEvent(percent, msg);
          this.showLog("updateCallback Update progress:" + percent + ", msg: " + msg);
          break;

         case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
         case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
          this.showLog("Failed to download manifest file, skip hot update.");
          failed = true;
          break;

         case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
          this.showLog("Already the latest version.");
          failed = true;
          break;

         case jsb.EventAssetsManager.UPDATE_FINISHED:
          this.showLog("The update is over." + event.getMessage());
          this.disPatchRateEvent(1);
          needRestart = true;
          break;

         case jsb.EventAssetsManager.UPDATE_FAILED:
          this.showLog("Update error." + event.getMessage());
          this._updating = false;
          this._canRetry = true;
          this._failCount++;
          this.retry();
          break;

         case jsb.EventAssetsManager.ERROR_UPDATING:
          this.showLog("Error during update:" + event.getAssetId() + ", " + event.getMessage());
          break;

         case jsb.EventAssetsManager.ERROR_DECOMPRESS:
          this.showLog("unzip error");
        }
        if (failed) {
          this._am.setEventCallback(null);
          this._updating = false;
        }
        if (needRestart) {
          this._am.setEventCallback(null);
          var searchPaths = jsb.fileUtils.getSearchPaths();
          var newPaths = this._am.getLocalManifest().getSearchPaths();
          Array.prototype.unshift.apply(searchPaths, newPaths);
          cc.sys.localStorage.setItem("HotUpdateSearchPaths", JSON.stringify(searchPaths));
          jsb.fileUtils.setSearchPaths(searchPaths);
          cc.audioEngine.stopAll();
          setTimeout(function() {
            cc.game.restart();
          }, 100);
        }
      },
      hotUpdate: function hotUpdate() {
        if (this._am && !this._updating) {
          this._am.setEventCallback(this.updateCallback.bind(this));
          if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            var url = this.manifestUrl.nativeUrl;
            cc.assetManager.md5Pipe && (url = cc.assetManager.md5Pipe.transformURL(url));
            this._am.loadLocalManifest(url);
          }
          this._failCount = 0;
          this._am.update();
          this._updating = true;
        }
      },
      checkCallback: function checkCallback(event) {
        switch (event.getEventCode()) {
         case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
          this.showLog("The local manifest file was not found, and the hot update was skipped.");
          this.hotUpdateFinish(true);
          break;

         case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
         case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
          this.showLog("Failed to download manifest file, skip hot update.");
          this.hotUpdateFinish(false);
          break;

         case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
          this.showLog("updated.");
          this.hotUpdateFinish(true);
          break;

         case jsb.EventAssetsManager.NEW_VERSION_FOUND:
          this.showLog("There is a new version, need to update");
          this._updating = false;
          this.hotUpdate();
          return;

         case jsb.EventAssetsManager.UPDATE_PROGRESSION:
          var percent = event.getPercent();
          if (isNaN(percent)) return;
          var msg = event.getMessage();
          this.showLog("checkCallback Update progress:" + percent + ", msg: " + msg);
          return;

         default:
          console.log("event.getEventCode():" + event.getEventCode());
          return;
        }
        this._am.setEventCallback(null);
        this._updating = false;
      },
      checkUpdate: function checkUpdate() {
        if (this._updating) {
          cc.log("Checking for updates...");
          return;
        }
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
          var url = this.manifestUrl.nativeUrl;
          cc.assetManager.md5Pipe && (url = cc.assetManager.md5Pipe.transformURL(url));
          this._am.loadLocalManifest(url);
        }
        if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
          this.showLog("Failed to load manifest file");
          return;
        }
        this._am.setEventCallback(this.checkCallback.bind(this));
        this._am.checkUpdate();
        this._updating = true;
        this.disPatchRateEvent(.01);
      },
      hotUpdateFinish: function hotUpdateFinish(result) {
        cc.director.emit("HotUpdateFinish", result);
      },
      disPatchRateEvent: function disPatchRateEvent(percent) {
        percent > 1 && (percent = 1);
        cc.director.emit("HotUpdateRate", percent);
      }
    });
    cc._RF.pop();
  }, {} ],
  LoginView: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "279d8WtB4RHzak/MgK2/4ZW", "LoginView");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {
        menuNode: {
          default: null,
          type: cc.Node
        },
        labelTips: {
          default: null,
          type: cc.Label
        }
      },
      onLoad: function onLoad() {
        this.menuNode.active = true;
      },
      onDestroy: function onDestroy() {},
      onEnable: function onEnable() {
        cc.director.on("HotUpdateFinish", this.onHotUpdateFinish, this);
        cc.director.on("HotUpdateRate", this.onHotUpdateRate, this);
      },
      onDisable: function onDisable() {
        cc.director.off("HotUpdateFinish", this.onHotUpdateFinish, this);
        cc.director.off("HotUpdateRate", this.onHotUpdateRate, this);
      },
      checkVersion: function checkVersion() {},
      onUpdateFinish: function onUpdateFinish() {
        this.menuNode.active = true;
        this.labelTips.string = "";
      },
      onHotUpdateFinish: function onHotUpdateFinish(param) {
        var result = param;
        result, this.onUpdateFinish();
      },
      onHotUpdateRate: function onHotUpdateRate(param) {
        var percent = param;
        percent > 1 && (percent = 1);
        this._updatePercent = percent;
        this.labelTips.string = "\u0110ANG TI\u1ebeN H\xc0NH C\u1eacP NH\u1eacT T\xc0I NGUY\xcaN GAME, TI\u1ebeN \u0110\u1ed8 C\u1eacP NH\u1eacT " + parseInt(1e4 * percent) / 100 + "%";
      },
      onBtnStartGame: function onBtnStartGame() {
        cc.director.loadScene("GameScence");
      },
      onBtnBill: function onBtnBill() {
        cc.director.loadScene("Game");
      }
    });
    cc._RF.pop();
  }, {} ],
  SoundMN: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "0c31dVDu7FDyLicCRRPX1/X", "SoundMN");
    "use strict";
    var Sound = cc.Class({
      properties: {
        n: {
          default: "",
          type: cc.String
        },
        clip: {
          default: null,
          type: cc.AudioClip
        }
      }
    });
    cc._RF.pop();
  }, {} ],
  "audio-manager": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "a5358v+LMRMCKIcjoasrMOD", "audio-manager");
    "use strict";
    var AudioManager = cc.Class({
      extends: cc.Component,
      properties: {
        coinsWin: {
          default: null,
          type: cc.AudioClip
        },
        coinsInsert: {
          default: null,
          type: cc.AudioClip
        },
        diceSound: {
          default: null,
          type: cc.AudioClip
        },
        timerSound: {
          default: null,
          type: cc.AudioClip
        },
        bgSound: {
          default: null,
          type: cc.AudioClip
        }
      },
      statics: {
        instance: null
      },
      playbgSound: function playbgSound() {
        cc.audioEngine.playMusic(this.bgSound, false);
      },
      playCoinsWin: function playCoinsWin() {
        cc.audioEngine.playMusic(this.coinsWin, false);
      },
      playCoinsInsert: function playCoinsInsert() {
        cc.audioEngine.playEffect(this.coinsInsert, false);
      },
      playDiceSound: function playDiceSound() {
        cc.audioEngine.playEffect(this.diceSound, false);
      },
      playTimeSound: function playTimeSound() {
        cc.audioEngine.playEffect(this.timerSound, false);
      },
      playStop: function playStop(AudioClip) {
        if (!AudioClip) return;
      },
      onLoad: function onLoad() {
        AudioManager.instance = this;
      }
    });
    cc._RF.pop();
  }, {} ],
  coinAction: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "a32bb/iX2dPhavykvjiovIR", "coinAction");
    "use strict";
    function _createForOfIteratorHelperLoose(o, allowArrayLike) {
      var it;
      if ("undefined" === typeof Symbol || null == o[Symbol.iterator]) {
        if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && "number" === typeof o.length) {
          it && (o = it);
          var i = 0;
          return function() {
            if (i >= o.length) return {
              done: true
            };
            return {
              done: false,
              value: o[i++]
            };
          };
        }
        throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      }
      it = o[Symbol.iterator]();
      return it.next.bind(it);
    }
    function _unsupportedIterableToArray(o, minLen) {
      if (!o) return;
      if ("string" === typeof o) return _arrayLikeToArray(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      "Object" === n && o.constructor && (n = o.constructor.name);
      if ("Map" === n || "Set" === n) return Array.from(o);
      if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
    }
    function _arrayLikeToArray(arr, len) {
      (null == len || len > arr.length) && (len = arr.length);
      for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
      return arr2;
    }
    var coinAction = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        coinAction.instance = this;
      },
      start: function start() {},
      coinMoveForWin: function coinMoveForWin(arrayNode) {
        for (var _iterator = _createForOfIteratorHelperLoose(arrayNode), _step; !(_step = _iterator()).done; ) {
          var coinmove = _step.value;
          cc.tween(coinmove).repeat(1, cc.tween().to(2, {
            position: cc.v2(962.823, -800)
          })).start();
        }
      },
      coinMoveForLoss: function coinMoveForLoss(arrayNode) {
        for (var _iterator2 = _createForOfIteratorHelperLoose(arrayNode), _step2; !(_step2 = _iterator2()).done; ) {
          var coinmove = _step2.value;
          cc.tween(coinmove).repeat(1, cc.tween().to(2, {
            position: cc.v2(962, 1800)
          })).start();
        }
      },
      clearCoin_Tai: function clearCoin_Tai(coinmove1, defaultSprCoin1, taiNodestop, arrayTaiNode) {
        var _this = this;
        var posx = this.resultBetTaiXiu(-200, 200);
        var posy = this.resultBetTaiXiu(-80, 80);
        coinmove1.runAction(cc.sequence(cc.moveTo(.1, cc.v2(taiNodestop.x + posx, taiNodestop.y - posy)), cc.callFunc(function() {
          var coin = cc.instantiate(coinmove1);
          coin.setPosition(coinmove1.position);
          _this.node.addChild(coin);
          arrayTaiNode.push(coin);
          coinmove1.setPosition(defaultSprCoin1);
        })));
      },
      clearCoin_Xiu: function clearCoin_Xiu(coinmove1, defaultSprCoin1, xiaNodestop, arrayXuiNode) {
        var _this2 = this;
        var posx = this.resultBetTaiXiu(-200, 200);
        var posy = this.resultBetTaiXiu(-80, 80);
        coinmove1.runAction(cc.sequence(cc.moveTo(.1, cc.v2(xiaNodestop.x + posx, xiaNodestop.y - posy)), cc.callFunc(function() {
          var coin = cc.instantiate(coinmove1);
          coin.setPosition(coinmove1.position);
          _this2.node.addChild(coin);
          arrayXuiNode.push(coin);
          coinmove1.setPosition(defaultSprCoin1);
        })));
      },
      resultBetTaiXiu: function resultBetTaiXiu(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
    });
    cc._RF.pop();
  }, {} ],
  coinStyle: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "a55adyXfNtAHK5NjaGbz+/d", "coinStyle");
    "use strict";
    var coinStyle = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        coinStyle.instance = this;
      },
      start: function start() {},
      styleCoinFour: function styleCoinFour(coinArray, coin4, defaultSprCoin4) {
        coinArray[3].opacity = 0;
        var stop1 = cc.instantiate(coin4[0]);
        stop1.setPosition(coinArray[3].position);
        this.node.addChild(stop1);
        coinArray[3] = stop1;
        coinArray[3].setPosition(defaultSprCoin4);
      },
      styleCoinFive: function styleCoinFive(coinArray, coin5, defaultSprCoin5) {
        coinArray[4].opacity = 0;
        var stop1 = cc.instantiate(coin5[0]);
        stop1.setPosition(coinArray[4].position);
        this.node.addChild(stop1);
        coinArray[4] = stop1;
        coinArray[4].setPosition(defaultSprCoin5);
      },
      styleCoinSix: function styleCoinSix(coinArray, coin6, defaultSprCoin6) {
        coinArray[5].opacity = 0;
        var stop1 = cc.instantiate(coin6[0]);
        stop1.setPosition(this.coinArray[5].position);
        this.node.addChild(stop1);
        coinArray[5] = stop1;
        coinArray[5].setPosition(defaultSprCoin6);
      }
    });
    cc._RF.pop();
  }, {} ],
  coinSwitchlight: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "ed0d5SvKslBv76fEcnatrGn", "coinSwitchlight");
    "use strict";
    var coinLight = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        coinLight.instance = this;
      },
      coinLight: function coinLight(coinArray, coin4, defaultSprCoin4) {
        coinArray[3].opacity = 0;
        var stop = cc.instantiate(coin4[1]);
        stop.setPosition(coinArray[3].position);
        this.node.addChild(stop);
        coinArray[3] = stop;
        coinArray[3].setPosition(defaultSprCoin4);
      },
      coinSwitchLight: function coinSwitchLight(coinArray, coin5, defaultSprCoin5) {
        coinArray[4].opacity = 0;
        var stop = cc.instantiate(coin5[1]);
        stop.setPosition(coinArray[4].position);
        this.node.addChild(stop);
        coinArray[4] = stop;
        coinArray[4].setPosition(defaultSprCoin5);
      },
      coinLightSwitch: function coinLightSwitch(coinArray, coin6, defaultSprCoin6) {
        coinArray[5].opacity = 0;
        var stop = cc.instantiate(coin6[1]);
        stop.setPosition(coinArray[5].position);
        this.node.addChild(stop);
        coinArray[5] = stop;
        coinArray[5].setPosition(defaultSprCoin6);
      },
      start: function start() {}
    });
    cc._RF.pop();
  }, {} ],
  coinSwitch: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "d2206MgwYFFH43Rc4zJJVVU", "coinSwitch");
    "use strict";
    var coinSwith = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        coinSwith.instance = this;
      },
      coinBet: function coinBet(coinArray, coin1, defaultSprCoin1) {
        coinArray[0].opacity = 0;
        var stop = cc.instantiate(coin1[1]);
        stop.setPosition(coinArray[0].position);
        this.node.addChild(stop);
        coinArray[0] = stop;
        coinArray[0].setPosition(defaultSprCoin1);
      },
      coinSwitch: function coinSwitch(coinArray, coin2, defaultSprCoin2) {
        coinArray[1].opacity = 0;
        var stop = cc.instantiate(coin2[1]);
        stop.setPosition(coinArray[1].position);
        this.node.addChild(stop);
        coinArray[1] = stop;
        coinArray[1].setPosition(defaultSprCoin2);
      },
      coinBetSwitch: function coinBetSwitch(coinArray, coin3, defaultSprCoin3) {
        coinArray[2].opacity = 0;
        var stop = cc.instantiate(coin3[1]);
        stop.setPosition(coinArray[2].position);
        this.node.addChild(stop);
        coinArray[2] = stop;
        coinArray[2].setPosition(defaultSprCoin3);
      },
      start: function start() {}
    });
    cc._RF.pop();
  }, {} ],
  game: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "7130eyumnpLaJWgrpVBQo3h", "game");
    "use strict";
    var coinAction = require("coinAction"), shakeCub = require("shakeCub"), coinSwitch = require("coinSwitch"), coinLight = require("coinSwitchlight"), resultCubBet = require("resultCubBet"), normalCoin = require("normalCoin"), coinStyle = require("coinStyle"), Sound = require("SoundMN");
    cc.Class({
      extends: cc.Component,
      properties: {
        musicSound: [ Sound ],
        sfxSound: [ Sound ],
        musicSource: {
          default: null,
          type: cc.AudioSource
        },
        sfxSource: {
          default: null,
          type: cc.AudioSource
        },
        musicSlider: {
          default: null,
          type: cc.Slider
        },
        sfxSlider: {
          default: null,
          type: cc.Slider
        },
        setting: {
          default: null,
          type: cc.Node
        },
        coin1: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin2: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin3: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin4: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin5: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin6: {
          default: [],
          type: [ cc.Prefab ]
        },
        coinArray: {
          default: [],
          type: [ cc.Node ]
        },
        coinmoveArray: {
          default: [],
          type: [ cc.Node ]
        },
        valuecoin1: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin2: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin3: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin4: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin5: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin6: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        taiNode: {
          default: null,
          type: cc.Node
        },
        xiaNode: {
          default: null,
          type: cc.Node
        },
        taiNodestop: {
          default: null,
          type: cc.Node
        },
        xiaNodestop: {
          default: null,
          type: cc.Node
        },
        arrayTaiNode: {
          default: [],
          visible: false,
          type: [ cc.Node ]
        },
        arrayXuiNode: {
          default: [],
          visible: false,
          type: [ cc.Node ]
        },
        valuecretedite: {
          default: 0,
          type: cc.Integer
        },
        creditLabel: {
          default: null,
          type: cc.Label
        },
        taiLabel: {
          default: null,
          type: cc.Label
        },
        xiuLabel: {
          default: null,
          type: cc.Label
        },
        taivalue: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        xiuvalue: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        cubArray: {
          default: [],
          type: [ cc.Node ]
        },
        timeLabel: {
          default: null,
          type: cc.Label
        },
        timecount: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        stopscub: {
          default: [],
          type: [ cc.Prefab ]
        },
        totalValuesDice: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        valueWin: {
          default: null,
          visible: false,
          type: cc.Integer
        },
        labelWin: {
          default: null,
          type: cc.Label
        },
        refnode: {
          default: null,
          type: cc.Node
        },
        exitnode: {
          default: null,
          type: cc.Node
        },
        Nodetaiwin: {
          default: null,
          type: cc.Node
        },
        NodeXiuwin: {
          default: null,
          type: cc.Node
        },
        TaiGlow: {
          default: null,
          type: cc.Animation
        },
        XiuGlow: {
          default: null,
          type: cc.Animation
        }
      },
      statics: {
        defaultSprCoin1: null,
        defaultSprCoin2: null,
        defaultSprCoin3: null,
        defaultSprCoin4: null,
        defaultSprCoin5: null,
        defaultSprCoin6: null
      },
      onLoad: function onLoad() {
        this.PlayMusic("Music");
        this.allButtonFun();
        this.timeToBet();
      },
      timeToBet: function timeToBet() {
        this.timecount = 20;
        this.schedule(function() {
          this.valueWin = 0;
          if (this.timecount > 0) {
            this.PlaySFX("Time");
            this.timeLabel.string = "" + this.timecount;
            this.labelWin.string = this.valueWin + "K";
          }
          if (-1 == this.timecount) {
            this.cubArray[0].opacity = 0;
            this.cubArray[1].opacity = 0;
            this.cubArray[2].opacity = 0;
            this.timeLabel.string = "GO";
            this.cub();
          }
          this.timecount < 0 && this.timecount > -5 && this.PlaySFX("Dice");
          if (-7 == this.timecount) {
            this.totalfun();
            this.moveCoin();
            this.cubArray[0].opacity = 255;
            this.cubArray[1].opacity = 255;
            this.cubArray[2].opacity = 255;
          }
          if (-10 == this.timecount) {
            this.NodeXiuwin.opacity = 0;
            this.Nodetaiwin.opacity = 0;
            shakeCub.instance.clearArrayCoin(this.arrayTaiNode, this.arrayXuiNode);
            this.timecount = 20;
          }
          this.timecount--;
        }, 1);
      },
      totalfun: function totalfun() {
        if (this.totalValuesDice <= 10) {
          this.PlaySFX("Win");
          this.TaiGlow.play("winAnim");
          this.NodeXiuwin.opacity = 255;
          this.Nodetaiwin.opacity = 0;
          this.valueWin = 2 * this.xiuvalue;
          this.valuecretedite = this.valuecretedite + this.valueWin;
          this.labelWin.string = this.valueWin + "K";
          this.creditLabel.string = this.valuecretedite + "K";
          coinAction.instance.coinMoveForWin(this.arrayXuiNode);
          coinAction.instance.coinMoveForLoss(this.arrayTaiNode);
        } else {
          this.PlaySFX("Win");
          this.XiuGlow.play("winAnim");
          this.Nodetaiwin.opacity = 255;
          this.NodeXiuwin.opacity = 0;
          this.valueWin = 2 * this.taivalue;
          this.valuecretedite = this.valuecretedite + this.valueWin;
          this.labelWin.string = this.valueWin + "K";
          this.creditLabel.string = this.valuecretedite + "K";
          coinAction.instance.coinMoveForLoss(this.arrayXuiNode);
          coinAction.instance.coinMoveForWin(this.arrayTaiNode);
        }
      },
      coin1function: function coin1function() {
        if (true == this.valuecoin1) {
          this.PlaySFX("Tap");
          shakeCub.instance.betCoinSwitch(this.coinArray[0], this.coin1, this.defaultSprCoin1);
        }
      },
      coin2function: function coin2function() {
        if (true == this.valuecoin2) {
          this.PlaySFX("Tap");
          shakeCub.instance.betCoinSwitch(this.coinArray[1], this.coin2, this.defaultSprCoin2);
        }
      },
      coin3function: function coin3function() {
        if (true == this.valuecoin3) {
          this.PlaySFX("Tap");
          shakeCub.instance.betCoinSwitch(this.coinArray[2], this.coin3, this.defaultSprCoin3);
        }
      },
      coin4function: function coin4function() {
        if (true == this.valuecoin4) {
          this.PlaySFX("Tap");
          shakeCub.instance.betCoinSwitch(this.coinArray[3], this.coin4, this.defaultSprCoin4);
        }
      },
      coin5function: function coin5function() {
        if (true == this.valuecoin5) {
          this.PlaySFX("Tap");
          shakeCub.instance.betCoinSwitch(this.coinArray[4], this.coin5, this.defaultSprCoin5);
        }
      },
      coin6function: function coin6function() {
        if (true == this.valuecoin6) {
          this.PlaySFX("Tap");
          shakeCub.instance.betCoinSwitch(this.coinArray[5], this.coin6, this.defaultSprCoin6);
        }
      },
      coin1Bet: function coin1Bet() {
        if (true == this.valuecoin1) {
          coinSwitch.instance.coinBet(this.coinArray, this.coin1, this.defaultSprCoin1);
          this.valuecoin1 = false;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin2function();
          this.coin3function();
          this.coin4function();
          this.coin5function();
          this.coin6function();
        } else {
          normalCoin.instance.coinNormalOne(this.coinArray, this.coin1, this.defaultSprCoin1);
          this.valuecoin1 = true;
        }
      },
      coin2Bet: function coin2Bet() {
        if (true == this.valuecoin2) {
          coinSwitch.instance.coinSwitch(this.coinArray, this.coin2, this.defaultSprCoin2);
          this.valuecoin2 = false;
          this.valuecoin1 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin3function();
          this.coin4function();
          this.coin5function();
          this.coin6function();
        } else {
          this.valuecoin2 = true;
          normalCoin.instance.coinNormalTwo(this.coinArray, this.coin2, this.defaultSprCoin2);
        }
      },
      coin3Bet: function coin3Bet() {
        if (true == this.valuecoin3) {
          coinSwitch.instance.coinBetSwitch(this.coinArray, this.coin3, this.defaultSprCoin3);
          this.valuecoin3 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin2function();
          this.coin4function();
          this.coin5function();
          this.coin6function();
        } else {
          normalCoin.instance.coinNormalThree(this.coinArray, this.coin3, this.defaultSprCoin3);
          this.valuecoin3 = true;
        }
      },
      coin4Bet: function coin4Bet() {
        if (true == this.valuecoin4) {
          coinLight.instance.coinLight(this.coinArray, this.coin4, this.defaultSprCoin4);
          this.valuecoin4 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin2function();
          this.coin3function();
          this.coin5function();
          this.coin6function();
        } else {
          coinStyle.instance.styleCoinFour(this.coinArray, this.coin4, this.defaultSprCoin4);
          this.valuecoin4 = true;
        }
      },
      coin5Bet: function coin5Bet() {
        if (true == this.valuecoin5) {
          coinLight.instance.coinSwitchLight(this.coinArray, this.coin5, this.defaultSprCoin5);
          this.valuecoin5 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin2function();
          this.coin3function();
          this.coin4function();
          this.coin6function();
        } else {
          coinStyle.instance.styleCoinFive(this.coinArray, this.coin5, this.defaultSprCoin5);
          this.valuecoin5 = true;
        }
      },
      coin6Bet: function coin6Bet() {
        if (true == this.valuecoin6) {
          coinLight.instance.coinLightSwitch(this.coinArray, this.coin6, this.defaultSprCoin6);
          this.valuecoin6 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.coin1function();
          this.coin2function();
          this.coin3function();
          this.coin4function();
          this.coin5function();
        } else {
          coinStyle.instance.styleCoinSix(this.coinArray, this.coin6, this.defaultSprCoin6);
          this.valuecoin6 = true;
        }
      },
      allButtonFun: function allButtonFun() {
        this.buttonanimation(this.taiNode);
        this.buttonanimation(this.xiaNode);
        this.buttonanimation(this.refnode);
        this.buttonanimation(this.exitnode);
        this.buttonanimation(this.coinArray[0]);
        this.buttonanimation(this.coinArray[1]);
        this.buttonanimation(this.coinArray[2]);
        this.buttonanimation(this.coinArray[3]);
        this.buttonanimation(this.coinArray[4]);
        this.buttonanimation(this.coinArray[5]);
        this.defaultSprCoin1 = this.coinArray[0].position;
        this.defaultSprCoin2 = this.coinArray[1].position;
        this.defaultSprCoin3 = this.coinArray[2].position;
        this.defaultSprCoin4 = this.coinArray[3].position;
        this.defaultSprCoin5 = this.coinArray[4].position;
        this.defaultSprCoin6 = this.coinArray[5].position;
        this.coinArray[0].on(cc.Node.EventType.TOUCH_START, this.coin1Bet, this);
        this.coinArray[1].on(cc.Node.EventType.TOUCH_START, this.coin2Bet, this);
        this.coinArray[2].on(cc.Node.EventType.TOUCH_START, this.coin3Bet, this);
        this.coinArray[3].on(cc.Node.EventType.TOUCH_START, this.coin4Bet, this);
        this.coinArray[4].on(cc.Node.EventType.TOUCH_START, this.coin5Bet, this);
        this.coinArray[5].on(cc.Node.EventType.TOUCH_START, this.coin6Bet, this);
        this.taiNode.on(cc.Node.EventType.TOUCH_START, this.Tai, this);
        this.xiaNode.on(cc.Node.EventType.TOUCH_START, this.Xiu, this);
        this.exitnode.on(cc.Node.EventType.TOUCH_START, this.exitFun, this);
        this.refnode.on(cc.Node.EventType.TOUCH_START, this.refreshScence, this);
      },
      Tai: function Tai() {
        if (this.timecount <= 0) return;
        if (false == this.valuecoin1) {
          this.PlaySFX("Insert");
          if (this.valuecretedite >= 1) {
            coinAction.instance.clearCoin_Tai(this.coinmoveArray[0], this.defaultSprCoin1, this.taiNodestop, this.arrayTaiNode);
            this.valuecretedite -= 1;
            this.taivalue += 1;
            this.taiLabel.string = this.taivalue + "K";
            this.creditLabel.string = this.valuecretedite + "K";
          }
        }
        if (false == this.valuecoin2 && this.valuecretedite >= 5) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Tai(this.coinmoveArray[1], this.defaultSprCoin2, this.taiNodestop, this.arrayTaiNode);
          this.valuecretedite -= 5;
          this.taivalue += 5;
          this.taiLabel.string = this.taivalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
        if (false == this.valuecoin3 && this.valuecretedite >= 10) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Tai(this.coinmoveArray[2], this.defaultSprCoin3, this.taiNodestop, this.arrayTaiNode);
          this.valuecretedite -= 10;
          this.taivalue += 10;
          this.taiLabel.string = this.taivalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
        if (false == this.valuecoin4 && this.valuecretedite >= 20) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Tai(this.coinmoveArray[3], this.defaultSprCoin4, this.taiNodestop, this.arrayTaiNode);
          this.valuecretedite -= 20;
          this.taivalue += 20;
          this.taiLabel.string = this.taivalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
        if (false == this.valuecoin5 && this.valuecretedite >= 50) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Tai(this.coinmoveArray[4], this.defaultSprCoin5, this.taiNodestop, this.arrayTaiNode);
          this.valuecretedite -= 50;
          this.taivalue += 50;
          this.taiLabel.string = this.taivalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
        if (false == this.valuecoin6 && this.valuecretedite >= 100) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Tai(this.coinmoveArray[5], this.defaultSprCoin6, this.taiNodestop, this.arrayTaiNode);
          this.valuecretedite -= 100;
          this.taivalue += 100;
          this.taiLabel.string = this.taivalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
      },
      Xiu: function Xiu() {
        if (this.timecount <= 0) return;
        if (false == this.valuecoin1) {
          this.PlaySFX("Insert");
          if (this.valuecretedite >= 1) {
            coinAction.instance.clearCoin_Xiu(this.coinmoveArray[0], this.defaultSprCoin1, this.xiaNodestop, this.arrayXuiNode);
            this.valuecretedite -= 1;
            this.xiuvalue += 1;
            this.xiuLabel.string = this.xiuvalue + "K";
            this.creditLabel.string = this.valuecretedite + "K";
            console.log(" check value :  ------- : " + this.xiuvalue);
          }
        }
        if (false == this.valuecoin2 && this.valuecretedite >= 5) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Xiu(this.coinmoveArray[1], this.defaultSprCoin2, this.xiaNodestop, this.arrayXuiNode);
          this.valuecretedite -= 5;
          this.xiuvalue += 5;
          this.xiuLabel.string = this.xiuvalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
          console.log(" check value :  ------- : " + this.xiuvalue);
        }
        if (false == this.valuecoin3 && this.valuecretedite >= 10) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Xiu(this.coinmoveArray[2], this.defaultSprCoin3, this.xiaNodestop, this.arrayXuiNode);
          this.valuecretedite -= 10;
          this.xiuvalue += 10;
          this.xiuLabel.string = this.xiuvalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
          console.log(" check value :  ------- : " + this.xiuvalue);
        }
        if (false == this.valuecoin4 && this.valuecretedite >= 20) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Xiu(this.coinmoveArray[3], this.defaultSprCoin4, this.xiaNodestop, this.arrayXuiNode);
          this.valuecretedite -= 20;
          this.xiuvalue += 20;
          this.xiuLabel.string = this.xiuvalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
          console.log(" check value :  ------- : " + this.xiuvalue);
        }
        if (false == this.valuecoin5 && this.valuecretedite >= 50) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Xiu(this.coinmoveArray[4], this.defaultSprCoin5, this.xiaNodestop, this.arrayXuiNode);
          this.valuecretedite -= 50;
          this.xiuvalue += 50;
          this.xiuLabel.string = this.xiuvalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
        if (false == this.valuecoin6 && this.valuecretedite >= 100) {
          this.PlaySFX("Insert");
          coinAction.instance.clearCoin_Xiu(this.coinmoveArray[5], this.defaultSprCoin6, this.xiaNodestop, this.arrayXuiNode);
          this.valuecretedite -= 100;
          this.xiuvalue += 100;
          this.xiuLabel.string = this.xiuvalue + "K";
          this.creditLabel.string = this.valuecretedite + "K";
        }
      },
      cub: function cub() {
        var index1 = coinAction.instance.resultBetTaiXiu(0, 5);
        var index2 = coinAction.instance.resultBetTaiXiu(0, 5);
        var index3 = coinAction.instance.resultBetTaiXiu(0, 5);
        var stop3 = cc.instantiate(this.stopscub[index3]);
        this.node.addChild(stop3);
        stop3.setPosition(cc.v2(this.cubArray[2].position));
        this.cubArray[2] = stop3;
        shakeCub.instance.shakeCub3(this.cubArray[2]);
        var stop1 = cc.instantiate(this.stopscub[index1]);
        this.node.addChild(stop1);
        stop1.setPosition(cc.v2(this.cubArray[0].position));
        this.cubArray[0] = stop1;
        resultCubBet.instance.cubResultShake(this.cubArray[0]);
        var stop2 = cc.instantiate(this.stopscub[index2]);
        this.node.addChild(stop2);
        stop2.setPosition(cc.v2(this.cubArray[1].position));
        this.cubArray[1] = stop2;
        resultCubBet.instance.cub2(this.cubArray[1]);
        var valDice1 = 0;
        var valDice2 = 0;
        var valDice3 = 0;
        valDice1 = 0 == index1 ? 1 : 1 == index1 ? 2 : 2 == index1 ? 3 : 3 == index1 ? 4 : 4 == index1 ? 5 : 6;
        valDice2 = 0 == index2 ? 1 : 1 == index2 ? 2 : 2 == index2 ? 3 : 3 == index2 ? 4 : 4 == index2 ? 5 : 6;
        valDice3 = 0 == index3 ? 1 : 1 == index3 ? 2 : 2 == index3 ? 3 : 3 == index3 ? 4 : 4 == index3 ? 5 : 6;
        this.totalValuesDice = valDice1 + valDice2 + valDice3;
      },
      moveCoin: function moveCoin() {
        this.taivalue = 0;
        this.xiuvalue = 0;
        this.taiLabel.string = "0K";
        this.xiuLabel.string = "0K";
      },
      buttonanimation: function buttonanimation(stop) {
        var button = stop.addComponent(cc.Button);
        button.transition = cc.Button.Transition.SCALE;
        button.duration = .1;
        button.zoomScale = 1.03;
      },
      start: function start() {
        this.valuecretedite = 2e3;
        this.creditLabel.string = this.valuecretedite + "K";
        this.coin1function();
        this.coin2function();
        this.coin3function();
        this.coin4function();
        this.coin5function();
        this.coin6function();
      },
      update: function update(dt) {},
      back: function back() {
        this.PlaySFX("Tap");
        cc.audioEngine.stopAll();
        cc.director.loadScene("load");
      },
      PlayMusic: function PlayMusic(name) {
        var s = this.musicSound.find(function(s) {
          return s.n === name;
        });
        if (null == s) console.log("not found"); else {
          this.musicSource.clip = s.clip;
          this.musicSource.play();
        }
      },
      PlaySFX: function PlaySFX(name) {
        var s = this.sfxSound.find(function(s) {
          return s.n === name;
        });
        if (null == s) console.log("not found"); else {
          this.sfxSource.clip = s.clip;
          this.sfxSource.play();
        }
      },
      MusicVolum: function MusicVolum() {
        this.musicSource.volume = this.musicSlider.progress;
        if (0 == this.musicSource.volume) {
          this.musicSprite.spriteFrame = this.offMusicSpriteFrame;
          this.state1 = false;
        } else {
          this.musicSprite.spriteFrame = this.onMusicSpriteFrame;
          this.state1 = true;
        }
      },
      SFXVolume: function SFXVolume() {
        this.sfxSource.volume = this.sfxSlider.progress;
        if (0 == this.sfxSource.volume) {
          this.sfxSprite.spriteFrame = this.offSFXSpriteFrame;
          this.state2 = false;
        } else {
          this.sfxSprite.spriteFrame = this.onSFXSpriteFrame;
          this.state2 = true;
        }
      },
      Show_stt: function Show_stt() {
        this.PlaySFX("Tap");
        this.setting.setPosition(0, 0);
      },
      Hide_stt: function Hide_stt() {
        this.PlaySFX("Tap");
        this.setting.setPosition(8e4, 932.136);
      }
    });
    cc._RF.pop();
  }, {
    SoundMN: "SoundMN",
    coinAction: "coinAction",
    coinStyle: "coinStyle",
    coinSwitch: "coinSwitch",
    coinSwitchlight: "coinSwitchlight",
    normalCoin: "normalCoin",
    resultCubBet: "resultCubBet",
    shakeCub: "shakeCub"
  } ],
  normalCoin: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "790c7io4AlEw5AqGD/a3k72", "normalCoin");
    "use strict";
    var normalCoin = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        normalCoin.instance = this;
      },
      start: function start() {},
      coinNormalOne: function coinNormalOne(coinArray, coin1, defaultSprCoin1) {
        coinArray[0].opacity = 0;
        var stop1 = cc.instantiate(coin1[0]);
        stop1.setPosition(coinArray[0].position);
        this.node.addChild(stop1);
        coinArray[0] = stop1;
        coinArray[0].setPosition(defaultSprCoin1);
      },
      coinNormalTwo: function coinNormalTwo(coinArray, coin2, defaultSprCoin2) {
        this.coinArray[1].opacity = 0;
        var stop1 = cc.instantiate(coin2[0]);
        stop1.setPosition(coinArray[1].position);
        this.node.addChild(stop1);
        coinArray[1] = stop1;
        coinArray[1].setPosition(defaultSprCoin2);
      },
      coinNormalThree: function coinNormalThree(coinArray, coin3, defaultSprCoin3) {
        coinArray[2].opacity = 0;
        var stop1 = cc.instantiate(coin3[0]);
        stop1.setPosition(coinArray[2].position);
        this.node.addChild(stop1);
        coinArray[2] = stop1;
        coinArray[2].setPosition(defaultSprCoin3);
      }
    });
    cc._RF.pop();
  }, {} ],
  resultCubBet: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "24f5eavLZJBd4YyK1GkM3EC", "resultCubBet");
    "use strict";
    var resultCubBet = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        resultCubBet.instance = this;
      },
      start: function start() {},
      cubResultShake: function cubResultShake(stop) {
        var posx = stop.x;
        var posy = stop.y;
        cc.tween(stop).repeat(7, cc.tween().to(.2, {
          position: cc.v2(posx + 48, posy + 60),
          angle: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx + 80, posy + 140),
          angle: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx - 10, posy + 80),
          angle: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx, posy),
          angle: 0
        }, {
          easing: "easeOutCubic"
        })).start();
      },
      cub2: function cub2(stop) {
        var posx = stop.x;
        var posy = stop.y;
        cc.tween(stop).repeat(7, cc.tween().to(.2, {
          position: cc.v2(posx - 80, posy + 140),
          rotation: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx - 80, posy + 140),
          rotation: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx + 10, posy + 80),
          rotation: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx, posy),
          rotation: 0
        }, {
          easing: "easeOutCubic"
        })).start();
      }
    });
    cc._RF.pop();
  }, {} ],
  shakeCub: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "e4c53voogBIaqcyX1swoQOs", "shakeCub");
    "use strict";
    function _createForOfIteratorHelperLoose(o, allowArrayLike) {
      var it;
      if ("undefined" === typeof Symbol || null == o[Symbol.iterator]) {
        if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && "number" === typeof o.length) {
          it && (o = it);
          var i = 0;
          return function() {
            if (i >= o.length) return {
              done: true
            };
            return {
              done: false,
              value: o[i++]
            };
          };
        }
        throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      }
      it = o[Symbol.iterator]();
      return it.next.bind(it);
    }
    function _unsupportedIterableToArray(o, minLen) {
      if (!o) return;
      if ("string" === typeof o) return _arrayLikeToArray(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      "Object" === n && o.constructor && (n = o.constructor.name);
      if ("Map" === n || "Set" === n) return Array.from(o);
      if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
    }
    function _arrayLikeToArray(arr, len) {
      (null == len || len > arr.length) && (len = arr.length);
      for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
      return arr2;
    }
    var shakeCub = cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {
        shakeCub.instance = this;
      },
      start: function start() {},
      shakeCub3: function shakeCub3(stop) {
        var posx = stop.x;
        var posy = stop.y;
        cc.tween(stop).repeat(7, cc.tween().to(.2, {
          position: cc.v2(posx - 40, posy + 120),
          rotation: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx - 10, posy + 120),
          rotation: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx + 24, posy + 34),
          rotation: 360
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx + 40, posy + 10),
          rotation: 0
        }, {
          easing: "easeOutCubic"
        }).call(function() {}).to(.1, {
          position: cc.v2(posx, posy),
          rotation: 0
        }, {
          easing: "easeOutCubic"
        })).start();
      },
      betCoinSwitch: function betCoinSwitch(coinNode1, coin1, defaultSprCoin1) {
        coinNode1.opacity = 0;
        var stop = cc.instantiate(coin1[0]);
        stop.setPosition(coinNode1.position);
        this.node.addChild(stop);
        coinNode1 = stop;
        coinNode1.setPosition(defaultSprCoin1);
      },
      clearArrayCoin: function clearArrayCoin(arrayTaiNode, arrayXuiNode) {
        for (var _iterator = _createForOfIteratorHelperLoose(arrayTaiNode), _step; !(_step = _iterator()).done; ) {
          var coinmove = _step.value;
          coinmove.destroy();
        }
        for (var _iterator2 = _createForOfIteratorHelperLoose(arrayXuiNode), _step2; !(_step2 = _iterator2()).done; ) {
          var _coinmove = _step2.value;
          _coinmove.destroy();
        }
      }
    });
    cc._RF.pop();
  }, {} ],
  start: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "0b8d77FjlVACYXZo2WK+PRY", "start");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {},
      start: function start() {},
      loadUI: function loadUI() {
        cc.director.loadScene("GameScence");
      }
    });
    cc._RF.pop();
  }, {} ]
}, {}, [ "SoundMN", "audio-manager", "coinAction", "coinStyle", "coinSwitch", "coinSwitchlight", "game", "HotUpdateModule", "LoginView", "normalCoin", "resultCubBet", "shakeCub", "start" ]);
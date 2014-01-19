define(['require','github:janesconference/tuna@master/tuna',
        'github:janesconference/KievII@0.6.0/kievII'], function(require, Tuna, K2) {
  
    var pluginConf = {
        name: "Shear",
        osc: false,
        audioOut: 1,
        audioIn: 0,
        version: '0.0.1',
        hyaId: 'ShearSynth',
        ui: {
            type: 'canvas',
            width: 574,
            height: 230
        },
        hostParameters : {
            enabled: false,
            parameters: {
                waves: {
                    name: ['Waves', 'W'],
                    label: '',
                    range: {
                        min: 1,
                        default: 3,
                        max: 200
                    }
                },
                detune: {
                    name: ['Detune', 'd'],
                    label: 'st',
                    range: {
                        min: 1,
                        default: 12,
                        max: 60
                    }
                },
                attack: {
                    name: ['Attack', 'A'],
                    label: 'sec',
                    range: {
                        min: 0,
                        default: 0,
                        max: 1
                    }
                },
                decay: {
                    name: ['Decay', 'd'],
                    label: 'sec',
                    range: {
                        min: 0,
                        default: 3,
                        max: 3
                    }
                },
                sustain: {
                    name: ['Sustain', 'S'],
                    label: 'ratio',
                    range: {
                        min: 0,
                        default: 1,
                        max: 1
                    }
                },
                release: {
                    name: ['Release', 'R'],
                    label: 'sec',
                    range: {
                        min: 0,
                        default: 1,
                        max: 3
                    }
                }
            }
        }
    };
  
    var pluginFunction = function(args, resources) {

        /*for (var param in pluginConf.hostParameters.parameters) {
            if (pluginConf.hostParameters.parameters.hasOwnProperty(param)) {
                args.hostInterface.setParm (param, pluginConf.hostParameters.parameters[param].range.default);
            }
        }*/

        /* SHEAR */

        var Shear, ShearVoice, noteToFrequency, adsr;

        adsr = {
          /* Duration of attack, time in seconds. From 0 to 1, default 0 */
          attack: pluginConf.hostParameters.parameters.attack.range.default,
          /* Duration of decay, time in seconds. From 0 to 3, default 3 */
          decay: pluginConf.hostParameters.parameters.decay.range.default,
          /* Ratio of sustain, relative to maxGain (velocity). From 0 to 1, default 1 */
          sustain: pluginConf.hostParameters.parameters.sustain.range.default,
          /* Duration of release, time in seconds. From 0 to 3, default 1 */
          release: pluginConf.hostParameters.parameters.release.range.default
        };

        Shear = (function() {
        function Shear(context) {
          this.context = context;
          this.tuna = new Tuna(this.context);
          this.output = this.context.createGain();
          this.delay = new this.tuna.Delay({
            cutoff: 3000
          });
          this.delay.connect(this.output);
          this.voices = [];
          this.numSaws = 3;
          this.detune = 12;
        }

        Shear.prototype.noteOn = function(note, time, velocity) {
          var freq, voice;
          // TODO VELOCITY 0
          if (this.voices[note] != null) {
            return;
          }
          if (!time) {
            time = this.context.currentTime;
          }
          freq = noteToFrequency(note);
          voice = new ShearVoice(this.context, freq, this.numSaws, this.detune, velocity, adsr);
          voice.connect(this.delay.input);
          voice.start(time);
          return this.voices[note] = voice;
        };

        Shear.prototype.noteOff = function(note, time) {
          if (this.voices[note] == null) {
            return;
          }
          if (!time) {
            time = this.context.currentTime;
          }
          this.voices[note].stop(time);
          return delete this.voices[note];
        };

        Shear.prototype.connect = function(target) {
          return this.output.connect(target);
        };

        return Shear;

        }) ();

        ShearVoice = (function() {
        function ShearVoice(context, frequency, numSaws, detune, velocity, adsr) {

          var i, saw, _i, _ref;
          this.context = context;
          this.frequency = frequency;
          this.numSaws = numSaws;
          this.detune = detune;
          this.output = this.context.createGain();
          this.output.gain.value = 0;
          this.envelope = adsr;
          this.noteOnTime = null;
          this.noteOffTime = null;
          this.maxGain = 1 / this.numSaws;       
          if (velocity) {
            this.maxGain = this.maxGain * velocity / 127;
          }
          this.saws = [];
          for (i = _i = 0, _ref = this.numSaws; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            saw = this.context.createOscillator();
            saw.type = saw.SAWTOOTH /*saw.SQUARE*/;
            saw.frequency.value = this.frequency;
            saw.detune.value = -this.detune + i * 2 * this.detune / (this.numSaws - 1);
            saw.start(this.context.currentTime);
            saw.connect(this.output);
            this.saws.push(saw);
          }
        }

        ShearVoice.prototype.start = function(time) {

            //console.log ("ADSR", this.envelope);

            var attackTime = time + this.envelope.attack;
            var decayTime = attackTime + this.envelope.decay;

            //console.log ("time is: " + time + " attack time is: " + attackTime + " decay time is " + decayTime);

            this.noteOnTime = time;
            //pin value to ramp from
            this.output.gain.setValueAtTime(0.0, time);
            //attack
            this.output.gain.linearRampToValueAtTime(this.maxGain, attackTime);
            //decay
            this.output.gain.linearRampToValueAtTime(this.envelope.sustain * this.maxGain, decayTime);
        };

        ShearVoice.prototype.stop = function(time) {

          var _this = this;
          this.noteOffTime = time;

          this.output.gain.cancelScheduledValues(time);

          // release always starts at sustain volume, so set it
          this.output.gain.setValueAtTime(this.envelope.sustain * this.maxGain, time);

          this.output.gain.linearRampToValueAtTime(0.0, time + this.envelope.release);

          return setTimeout((function() {
            return _this.saws.forEach(function(saw) {
              return saw.disconnect();
            });
          }), Math.floor(((time + this.envelope.release) - this.context.currentTime) * 1000));
        };

        ShearVoice.prototype.connect = function(target) {
          return this.output.connect(target);
        };

        return ShearVoice;

        })();

        noteToFrequency = function(note) {
            return Math.pow(2, (note - 69) / 12) * 440.0;
        };

        /* /SHEAR */

        var knobImage = resources[0];
        var deckImage = resources[1];
        
        this.id = args.id;
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.audioDestination);
        this.shear = new Shear(this.context);
        this.shear.connect(this.masterGain);

        /* Parameter callback */
        var onParmChange = function (id, value) {
            switch (id) {
              case ("attack"):
              adsr.attack = value;
              break;
              case ("decay"):
              adsr.decay = value;
              break;
              case ("sustain"):
              adsr.sustain = value;
              break;
              case ("release"):
              adsr.release = value;
              break;
            }
        };

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                'attack': pluginConf.hostParameters.parameters.attack.range.default,
                'decay':  pluginConf.hostParameters.parameters.decay.range.default,
                'sustain': pluginConf.hostParameters.parameters.sustain.range.default,
                'release': pluginConf.hostParameters.parameters.release.range.default,
                'waves': pluginConf.hostParameters.parameters.waves.range.default,
                'detune': pluginConf.hostParameters.parameters.detune.range.default
            };
        }

        for (param in this.pluginState) {
            if (this.pluginState.hasOwnProperty(param)) {
                /* args.hostInterface.setParm (param, this.pluginState[param]); */
                onParmChange.apply (this, [param, this.pluginState[param]]);
            }
        }


        // INTERFACE STUFF

        /* INTERFACE INIT */
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas}, {'breakOnFirstEvent': true});

        /* BACKGROUND INIT */
        var bgArgs = new K2.Background({
            ID: 'background',
            image: deckImage,
            top: 0,
            left: 0
        });

        this.ui.addElement(bgArgs, {zIndex: 0});

        /* KEYS INIT */
        var keyCB = function (slot,value, element) {
            console.log ("Callback called for", element);
            var note, octave;

            var note = element;
            note += 60;
            if (value === 1) {
                this.shear.noteOn(note, 0, 95);
            }
            else {
                this.shear.noteOff(note, 0);
            }

            this.ui.refresh();
        }.bind(this);

        var key = {
            ID: "",
            left: 0,
            top: 130,
            mode: 'immediate',
            imagesArray : null,
            onValueSet: keyCB
        };

        for (var i = 0; i < 12; i+=1) {
            key.ID = i;
            key.left = 15 + (i * 45);
            key.imagesArray = [resources[4 + i * 2], resources[5 + i * 2]];
            this.ui.addElement(new K2.Button(key), {zIndex: 1});
        }

        /* KNOB INIT */
        // TODO these are duplicates
        this.knobDescription = [
            {id: 'attack', init: this.pluginState.attack, x: 195, y: 59},
            {id: 'decay', init: this.pluginState.decay, x: 264, y: 59},
            {id: 'sustain', init: this.pluginState.sustain, x: 336, y: 59},
            {id: 'release', init: this.pluginState.release, x: 406, y: 59},
            {id: 'waves', init: this.pluginState.waves, x: 30, y: 59},
            {id: 'detune', init: this.pluginState.detune, x: 102, y: 59}
        ];

        var knobArgs = {
            ID: '',
            left: 0 ,
            top: 140,
            imagesArray : [knobImage],
            sensitivity : 5000,
            tileWidth: 48,
            tileHeight: 48,
            imageNum: 64,
            bottomAngularOffset: 33,
            onValueSet: function (slot, value, element) {
                this.pluginState[element] = value;
                var scaledValue = K2.MathUtils.linearRange (0, 1, pluginConf.hostParameters.parameters[element].range.min, pluginConf.hostParameters.parameters[element].range.max, value);
                onParmChange.call (this, element, scaledValue);
                this.ui.refresh();
            }.bind(this),
            isListening: true
        };

        for (var i = 0; i < this.knobDescription.length; i+=1) {
            var currKnob = this.knobDescription[i];
            knobArgs.ID = currKnob.id;
            knobArgs.top = currKnob.y;
            knobArgs.left = currKnob.x;
            this.ui.addElement(new K2.Knob(knobArgs));
            var initValue = currKnob.init;
            var rangedInitValue = K2.MathUtils.linearRange (pluginConf.hostParameters.parameters[currKnob.id].range.min, pluginConf.hostParameters.parameters[currKnob.id].range.max, 0, 1, initValue);
            console.log ("Setting", currKnob.id, "to value", rangedInitValue);
            this.ui.setValue ({elementID: knobArgs.ID, value: rangedInitValue, fireCallback:false});
        }

        this.ui.refresh();

        // /INTERFACE

        var saveState = function () {
            return { data: this.pluginState };
        };
        args.hostInterface.setSaveState (saveState.bind(this));

        var onMIDIMessage = function (message, when) {
            var now = this.context.currentTime;
            //console.log ("arrived MIDI message: type / when / now", message.type, when, now);
            if (when && (when < now)) {
                console.log ("SHEAR: ******** OUT OF TIME MESSAGE " + message.type + " " + when + " < " + now);
            }
            if (message.type === 'noteon') {
                if (!when) {
                    this.shear.noteOn(message.pitch, 0, message.velocity);
                }
                else {
                    this.shear.noteOn(message.pitch, when, message.velocity);
                }
            }
            if (message.type === 'noteoff') {
                if (!when) {
                    this.shear.noteOff(message.pitch);
                }
                else {
                    this.shear.noteOff(message.pitch, when);
                }
            }
        };

        args.MIDIHandler.setMIDICallback (onMIDIMessage. bind (this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };


    var initPlugin = function(initArgs) {
        var args = initArgs;

        var requireErr = function (err) {
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error initializing plugin.'});
        }.bind(this);

        var keyNotes = 60;
        var resList = [
            './assets/images/48x48x64.png!image',
            './assets/images/deck.png!image',
            './assets/images/buttonsaw.png!image',
            './assets/images/buttonsquare.png!image'
        ];

        var keyNotes_images = [];
        for (var i = 0; i < 12; i+=1) {
            keyNotes_images.push('./assets/images/' + (keyNotes + i) + '_i.png!image');
            keyNotes_images.push('./assets/images/' + (keyNotes + i) + '_a.png!image');
        }
        resList = resList.concat(keyNotes_images);

        console.log ("requiring...");

        require (resList,
            function () {
                console.log ("required...");
                pluginFunction.call (this, args, arguments);
            }.bind(this),
            function (err) {
                console.log ("require error");
                requireErr (err);
            }
        );

    };
        
    return {
        initPlugin: initPlugin,
        pluginConf: pluginConf
    };
});
define(['require','github:janesconference/tuna@master/tuna'], function(require, Tuna) {
  
    var pluginConf = {
        name: "Shear",
        osc: false,
        audioOut: 1,
        audioIn: 0,
        version: '0.0.1',
        hyaId: 'ShearSynth',
        hostParameters : {
            enabled: true,
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
  
    var pluginFunction = function(args) {

        for (var param in pluginConf.hostParameters.parameters) {
            if (pluginConf.hostParameters.parameters.hasOwnProperty(param)) {
                args.hostInterface.setParm (param, pluginConf.hostParameters.parameters[param].range.default);
            }
        }

        /* SCISSOR */

        var Scissor, ScissorVoice, noteToFrequency, adsr;

        adsr = {
          /* Duration of attack, time in seconds. From 0 to 1, default 0 */
          attack: pluginConf.hostParameters.parameters.attack.range.default,
          /* Duration of decay, time in seconds. From 0 to 3, default 3 */
          decay: pluginConf.hostParameters.parameters.decay.range.default,
          /* Ratio of sustain, relative to maxGain (velocity). From 0 to 1, default 1 */
          sustain: pluginConf.hostParameters.parameters.sustain.range.default,
          /* Duration of release, time in seconds. From 0 to 3, default 1 */
          release: pluginConf.hostParameters.parameters.release.range.default,
        };

        Scissor = (function() {
        function Scissor(context) {
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

        Scissor.prototype.noteOn = function(note, time, velocity) {
          var freq, voice;
          // TODO VELOCITY 0
          if (this.voices[note] != null) {
            return;
          }
          if (!time) {
            time = this.context.currentTime;
          }
          freq = noteToFrequency(note);
          voice = new ScissorVoice(this.context, freq, this.numSaws, this.detune, velocity, adsr);
          voice.connect(this.delay.input);
          voice.start(time);
          return this.voices[note] = voice;
        };

        Scissor.prototype.noteOff = function(note, time) {
          if (this.voices[note] == null) {
            return;
          }
          if (time == null) {
            time = this.context.currentTime;
          }
          this.voices[note].stop(time);
          return delete this.voices[note];
        };

        Scissor.prototype.connect = function(target) {
          return this.output.connect(target);
        };

        return Scissor;

        }) ();

        ScissorVoice = (function() {
        function ScissorVoice(context, frequency, numSaws, detune, velocity, adsr) {

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

        ScissorVoice.prototype.start = function(time) {

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

        ScissorVoice.prototype.stop = function(time) {

          var _this = this;
          this.noteOffTime = time;

          this.output.gain.cancelScheduledValues(time);

          this.output.gain.linearRampToValueAtTime(0.0, time + this.envelope.release);

          return setTimeout((function() {
            return _this.saws.forEach(function(saw) {
              return saw.disconnect();
            });
          }), Math.floor(((time + this.envelope.release) - this.context.currentTime) * 1000));
        };

        ScissorVoice.prototype.connect = function(target) {
          return this.output.connect(target);
        };

        return ScissorVoice;

        })();

        noteToFrequency = function(note) {
            return Math.pow(2, (note - 69) / 12) * 440.0;
        };

        /* /SCISSOR */
        
        this.id = args.id;
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.audioDestination);
        this.scissor = new Scissor(this.context);
        this.scissor.connect(this.masterGain);

        /* Parameter callback */
        var onParmChange = function (id, value) {
            // TODO
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
                // TODO
            };
        }

        for (param in this.pluginState) {
            if (this.pluginState.hasOwnProperty(param)) {
                args.hostInterface.setParm (param, this.pluginState[param]);
                onParmChange.apply (this, [param, this.pluginState[param]]);
            }
        }

        var saveState = function () {
            return { data: this.pluginState };
        };
        args.hostInterface.setSaveState (saveState.bind(this));
        args.hostInterface.setHostCallback (onParmChange.bind(this));

        var onMIDIMessage = function (message, when) {
            var now = this.context.currentTime;
            //console.log ("arrived MIDI message: type / when / now", message.type, when, now);
            if (when && (when < now)) {
                console.log ("SHEAR: ******** OUT OF TIME MESSAGE " + message.type + " " + when + " < " + now);
            }
            if (message.type === 'noteon') {
                if (!when) {
                    this.scissor.noteOn(message.pitch, 0, message.velocity);
                }
                else {
                    this.scissor.noteOn(message.pitch, when, message.velocity);
                }
            }
            if (message.type === 'noteoff') {
                if (!when) {
                    this.scissor.noteOff(message.pitch);
                }
                else {
                    this.scissor.noteOff(message.pitch, when);
                }
            }
        };

        args.MIDIHandler.setMIDICallback (onMIDIMessage. bind (this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };
    
    
    var initPlugin = function(initArgs) {
        var args = initArgs;

        pluginFunction.call (this, args);
    
    };
        
    return {
        initPlugin: initPlugin,
        pluginConf: pluginConf
    };
});
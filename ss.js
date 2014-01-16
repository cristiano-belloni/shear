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
                    name: ['#waves', '#'],
                    label: '',
                    range: {
                        min: 1,
                        default: 3,
                        max: 200
                    }
                },
                detune: {
                    name: ['Detune', 'D'],
                    label: 'st',
                    range: {
                        min: 1,
                        default: 12,
                        max: 60
                    }
                }
            }
        }
    };
  
    var pluginFunction = function(args) {

        /* SCISSOR */

        var Scissor, ScissorVoice, noteToFrequency, adsr;

        adsr = {
          /* Duration of attack, time in seconds. From 0 to 1, default 0 */
          attack: 0.1,
          /* Duration of decay, time in seconds. From 0 to 3, default 3 */
          decay: 0.3,
          /* Ratio of sustain, relative to maxGain (velocity). From 0 to 1, default 1 */
          sustain: 1.0,
          /* Duration of release, time in seconds. From 0 to 3, default 1 */
          release: 1.0,
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
          if (time == null) {
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
          this.adsr = adsr;
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
            //return this.output.gain.setValueAtTime(this.maxGain, time);
            var now = time;
            //pin value to ramp from
            this.output.gain.setValueAtTime(this.maxGain, time);
            //attack
            this.output.gain.linearRampToValueAtTime(this.maxGain, time + this.envelope.attack);
            //decay
            this.output.gain.linearRampToValueAtTime(this.envelope.sustain * this.maxGain, time + this.envelope.attack + this.envelope.decay);
        };

        ScissorVoice.prototype.stop = function(time) {
          var _this = this;
          var now = time;

          //this.output.gain.setValueAtTime(0, time);

          this.output.gain.cancelScheduledValues(time);

          //release
          // Can't do this: if we're in an attack ramp or in a decay, the value will be something different from the sustain or the attack
          // value, which we can't predict. All events have been cancelled, so let's hope that it starts from the value at time time.
          // this.output.gain.setValueAtTime(valueatthetime?, time);
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
                console.log ("MORNINGSTAR: ******** OUT OF TIME OFF MESSAGE");
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
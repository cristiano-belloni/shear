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

        var Scissor, ScissorVoice, noteToFrequency;

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

        Scissor.prototype.noteOn = function(note, time) {
          var freq, voice;
          if (this.voices[note] != null) {
            this.noteOff(note,time);
            //return;
          }
          if (time == null) {
            time = this.context.currentTime;
          }
          freq = noteToFrequency(note);
          voice = new ScissorVoice(this.context, freq, this.numSaws, this.detune);
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
        function ScissorVoice(context, frequency, numSaws, detune) {
          var i, saw, _i, _ref;
          this.context = context;
          this.frequency = frequency;
          this.numSaws = numSaws;
          this.detune = detune;
          this.output = this.context.createGain();
          this.maxGain = 1 / this.numSaws;
          this.saws = [];
          for (i = _i = 0, _ref = this.numSaws; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            saw = this.context.createOscillator();
            saw.type = saw.SAWTOOTH/*saw.SQUARE*/;
            saw.frequency.value = this.frequency;
            saw.detune.value = -this.detune + i * 2 * this.detune / (this.numSaws - 1);
            saw.start(this.context.currentTime);
            saw.connect(this.output);
            this.saws.push(saw);
          }
        }

        ScissorVoice.prototype.start = function(time, velocity) {
          if (velocity) {
            return this.output.gain.setValueAtTime(velocity / 127, time);
          }
          return this.output.gain.setValueAtTime(this.maxGain, time);
        };

        ScissorVoice.prototype.stop = function(time) {
          var _this = this;
          this.output.gain.setValueAtTime(0, time);
          return setTimeout((function() {
            return _this.saws.forEach(function(saw) {
              return saw.disconnect();
            });
          }), Math.floor((time - this.context.currentTime) * 1000));
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
                    this.scissor.noteOn(message.pitch);
                }
                else {
                    this.scissor.noteOn(message.pitch, when);
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
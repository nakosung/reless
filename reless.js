Array.prototype.unique = function() {
    var o = {}, i, l = this.length, r = [];
    for(i=0; i<l;i+=1) o[this[i]] = this[i];
    for(i in o) r.push(o[i]);
    return r;
};

function refactor(input,env) {
    var indent_tab = '  '
    var colors = {};

    function unescapeHTML(html) {
        return $("<div />").html(html).text();
    }

    input = unescapeHTML(input);

    // strip comments
    input = input.replace(/\/\/@MIX/g,'@@@MIX');
    input = input.replace(/\/\/[^\n]*/g,'');
    input = input.replace(/@@@MIX/g,'//@MIX')

    input = input.replace(/\/\*[^\*]*\*\//g,'');
    input = input.trim();
    input = input.replace(/\s+/g,' ');

    // zium specific
    input = input.replace(/\s([^\s]*ul)_li/g,' $1 $1_li');

    function eat(x) {
        var r = input.substring(0,x);
        input = input.substring(x);
        return r.trim();
    }

    function token() {
        if (input.length == 0) throw 'unexpected end';
        var a = input.indexOf("{");
        var b = input.indexOf("}");
        var c = input.indexOf(";");
        if (a == 0 || b == 0) return eat(1);
        if (a < 0 && b < 0) { return eat(c < 0 ? input.length : c+1); }
        if (b < 0 || a>0 && a<b) return eat(c < 0 || c > a ? a : c+1);
        if (a < 0 || b>0 && b<a) return eat(c < 0 || c > b ? b : c+1);
    }

    function add(root,key) {
        key = key.replace(/>\s*/g,'>');
        key = key.replace(/([^ ])\./g,'$1 &.');
        key = key.replace(/([^:]):([^:])/g,'$1 &:$2');
        key = key.replace(/\s*\+\s*/g,' &+');
        key = key.replace(/\s*>\s*/g,' >');
        function _add(root,key,o) {
            function merge(a,b) {
                var sub = a.sub;
                Object.keys(b.sub).forEach(function(k){
                    if (sub[k] == undefined) {
                        sub[k] = b.sub[k];
                    } else {
                        sub[k] = merge(sub[k], b.sub[k]);
                    }
                });
                return {sub:sub,prop:[a.prop, b.prop].join(' ').trim()};
            }
            function ___add(root,x,o) {
                if (root[x]) {
                    root[x] = merge(root[x],o);
                } else {
                    root[x] = o;
                }
            }
            function __add(root,x,o) {
                var k = x.split(' ');
                while (k.length > 1) {
                    var a = k.shift();
                    if (root[a] == undefined) {
                        var T = {sub:{},prop:''};
                        root[a] = T;
                    }
                    root = root[a].sub;
                }
                //___add(root, k.shift(),o);
                ___add(root, k.shift(),o);
            }
            key.split(',').map(function(x){return x.trim()}).forEach(function(x){
                __add(root,x,o);
            })
        }

        _add(root, key,go());
    }

    function go() {
        // obj := T '{' [ T, obj ]* '}'
        var prop = [];
        var sub = {};
        var mixins = {};
        var mixin = false;

        var x = token();
        if (x != '}') {
            while (input.length) {
                if (x == '//@MIXIN') mixin = true;
                if (x == '//@MIXOUT') mixin = false;

                var y = token();
                if (y == '{') {
                    add(sub,x);
                    x = input.length && token();

                    if (mixin) {
                        mixins[x] = 1;
                    }
                } else if (y == '}') {
                    prop.push(x.trim());
                    break;
                } else {
                    prop.push(x.trim());
                    x = y;
                }
            }
        }

        return {sub:sub,prop:prop.join(' '),mixins:mixins};
    }

    function post(x) {
        if (x.prop && x.prop != '') {
            var prop = x.prop.trim().split(";");
            var r = [];
            var d = {};
            prop.forEach(function(p){
                var i = p.indexOf(":");
                if (i<0) {
                    if (p.length)
                        r.push(p);
                } else {
                    var k = p.substring(0,i).trim();
                    var v = p.substring(i+1).trim();

                    var re = /#([0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])/g;
                    var re2 = /@color\-([0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])/g;
                    function hex2(n) {
                        var x = n.toString(16);
                        if (x.length == 1) {
                            return "0" + x;
                        } else {
                            return x;
                        }
                    }
                    var re3 = /rgba\(([^\)]+)\)/g;
                    function conv_rgba(str,p1,offset,s) {
                        var x = p1.split(',');
                        var r = parseInt(x[0]);
                        var g = parseInt(x[1]);
                        var b = parseInt(x[2]);
                        var fade = x[3];
                        var color = "#"+hex2(r)+hex2(g)+hex2(b);
                        return "fade("+color+","+fade+")";
                    }
                    v = v.replace(re3,conv_rgba)
                    function convert(str,p1,offset,s) {
                        var c = colors[p1];
                        if (c == undefined) {
                            colors[p1] = c = {
                                r : parseInt(p1.substr(0,2),16),
                                g : parseInt(p1.substr(2,2),16),
                                b : parseInt(p1.substr(4,2),16),
                                ref : 1
                            }

                            c.CIELab = Hex.fromString(p1).toCIELab();
                            c.N = new CIELab(85,c.CIELab.a, c.CIELab.b).toHex().toString()


                            if (c.r == c.g && c.r == c.b) {
                                if (c.r == 0) {
                                    c.name = "black"
                                } else if (c.r == 255) {
                                    c.name = "white"
                                } else {
                                    c.name = "@gray-"+ hex2(c.r);
                                }
                            } else {
                                c.name = "@color-"+p1;
                            }
                        } else {
                            c.ref++;
                        }
                        return c.name;
                    }
                    v = v.replace(re2,convert);
                    v = v.replace(re,convert);

                    d[k] = v;
                }
            });
            Object.keys(d).forEach(function(k){
                r.push([k,d[k]].join(':'));
            });
            x.p = r.map(function(x){return x.trim()}).sort();
        }
        Object.keys(x.sub).forEach(function(y){
            post(x.sub[y]);
        })
    }

    function applyMixins(x,mixins) {
        var lmixins = {};
        $.extend(lmixins,mixins);
        $.each(x.sub,function(k,v){
            if (is_mixin(x,k)) {
                lmixins[k] = v
                v.args = []
                if (k.match(/\(.*\)/)) {
                    k.replace(/.*\((.*)\)/,'$1').replace(/\s*/g,'').split(',').forEach(function(p){
                        var x =  p.replace(/(@[^:)]*).*/,'$1')
                        if (x.length) {
                            v.args.push(x)
                        }
                    })
                }
            }
        })
        function match(a,b,args,def) {
            while (true) {
                if (a == b) return true;

                var i = a.indexOf('@');
                if (i<0) return false;

                if (a.substring(0,i) != b.substring(0,i)) return false;

                var M = /[\s,\)].*/;
                a = a.substr(i);
                b = b.substr(i);



                var m = a.replace(M,'');
                var n = b.replace(M,'');


                if (args[m] == undefined) {
                    console.warn('unknown parameter ', m)
                    return false;
                }
                if (args[m] != def) {
                    return false;
                }

                if (n.match(/\//) && n[0] != '"' && n[0] != "'") {
                    args[m] = '"' + n + '"'
                } else {
                    args[m] = n;
                }

                a = a.substr(m.length)
                b = b.substr(n.length)
            }
            // never reach here
        }
        function replace(mixinName,mixin,target) {
//                console.log(mixinName,target)
            var a = mixin.p;
            var b = target.p;
            if (a == undefined || b == undefined) return;

            var n = a.length, m = b.length;
            if (n<=m) {
                var i = 0, j = 0;
                var r = [];

                var args = {}
                var def = {}
                mixin.args.forEach(function(k){
                    args[k] = def
                })

                while (i < n && j < m) {
                    var s = a[i], t = b[j];

                    if (match(s,t,args,def)) {
                        r.push(j);
                        i++, j++;
                    } else if (s > t) {
                        j++;
                    } else {
                        break;
                    }
                }
                if (i == n) {
                    r.reverse().forEach(function(i){
                        b.splice(i,1);
                    });
                    var that = mixinName.replace("()","");
                    if (mixin.args.length) {
                        $.each(args,function(k,v){
                            that = that.replace(k,v);
                        })
                    }

                    b.push(that);
                    target.p = b.sort();
                    return true;
                }
            }
        }
        var loop = 0;
        while (true) {
            var applied = 0;
            $.each(x.sub,function(k,v){
                if (is_mixin(x,k)) return true;
                $.each(lmixins,function(mk,mv){
                    if (angular.isObject(mv) && mv != v && replace(mk,mv,v)) {
                        applied++;
                    }
                })
            })
            if (applied == 0) break;
            if (loop++ == 3) break;
        }
        $.each(x.sub,function(k,v){
            applyMixins(v,lmixins)
        })
    }

    function is_mixin(x,k) {
        return x.mixins && x.mixins[k] != undefined || k.match(/\(.*\)/);
    }

    function collapse(x) {
        var k = Object.keys(x.sub);
        k.forEach(function(k){
            collapse(x.sub[k]);
        })

        var new_sub = {};

        for (var i=0; i< k.length; ++i) {
            var a = k[i];
            var T = [a];
            if (x.sub[a].deleted) continue;
            var A = JSON.stringify(x.sub[a]);

            if (a == "&") {
                var AA = x.sub[a].sub;
                var l = Object.keys(AA);
                l.forEach(function(z){
                    new_sub[z] = AA[z];
                })
                continue;
            }

            if (!is_mixin(x,a)) {
                for (var j=i+1; j< k.length; ++j) {
                    var b = k[j];
                    var B = JSON.stringify(x.sub[b]);
                    if (!is_mixin(x,b) && A == B) {
                        T.push(b);
                        x.sub[b].deleted = true;
                    }
                }
            }

            new_sub[T.join(', ')] = x.sub[a];
        }

        x.sub = new_sub;
    }



    function treeToText(x,indent) {
        if (x.p) {
            x.prop = x.p.join("; ") + ";";
            x.prop = x.prop.replace(';;',';');
        }
        var output = '';
        indent = indent || '';
        var k = Object.keys(x.sub);
        var multiline = k.length > 0;
        if (multiline) output += '\n';
        if (x.prop && x.prop != '') {
            if (multiline) output += indent;
            output += x.prop;
            if (multiline) output += '\n'; else output += ' ';
        }
        k.forEach(function(y){
            var loc = y;
            var t = x.sub[y];
            while (true) {
                var kk = Object.keys(t.sub);
                if (kk.length == 1 && t.prop == '') {
                    loc += ' ' + kk[0];
                    t = t.sub[kk[0]];
                } else {
                    break;
                }
            }
            loc = loc.replace(/([^,]) &/g,'$1');
            if (indent == '') {
                loc = loc.replace(/^&/,'');
            }
            output += indent + loc + ' { ';
            output += treeToText(t,indent + indent_tab);
            output += "\n";
        })

        if (!multiline)
            output += "}";
        else if (indent.length) {
            output += indent.substr(0,indent.length-indent_tab.length) + '}'
        }
        return output;
    }

    var root = go();
    post(root)
    collapse(root)
    applyMixins(root,[])

    function getHeaderText() {
        return '/*redduck re-less; less refactorizer, http://github.com/nakosung/reless */';
    }

    function getColorDefinitionText() {
        var r = [];
        Object.keys(colors).forEach(function(x){
            var c = colors[x];
            if (c.name[0] == '@') {
                r.push(c.name+':#'+x+'; /* '+colors[x].ref+' times referenced */');
            }
        })
        return r.sort().join('\n')
    }

    if (env) {
        env.colors = colors;
    }

    return [ getHeaderText(), getColorDefinitionText(), treeToText(root) ].join('\n');
}
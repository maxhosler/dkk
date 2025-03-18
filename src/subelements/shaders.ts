//Shader code.

export const EXTERNAL_FRAG_SHADER: string = `
precision mediump float;

varying highp vec3 v_normal;
varying highp vec3 v_pos;
varying highp vec4 v_simplex_pos;

const highp vec3 LIGHT_DIR = normalize(vec3(-1,1,-1));

uniform float cull_dir;
uniform float transparency;
uniform vec3 color;
uniform mat4 simplex_colors;
uniform float do_simplex_color;
uniform float shade_amount;

void main() {
    if(cull_dir * v_normal.z < 0.0)
    {
        discard;
    }

    vec3 true_color = color;
    if(do_simplex_color > 0.0)
    {
        float mx = max(max(max(v_simplex_pos.x, v_simplex_pos.y), v_simplex_pos.z), v_simplex_pos.w);
        if(mx == v_simplex_pos.x)
        {
            true_color = simplex_colors[0].xyz;
        }
        else if(mx == v_simplex_pos.y)
        {
            true_color = simplex_colors[1].xyz;
        }
        else if(mx == v_simplex_pos.z)
        {
            true_color = simplex_colors[2].xyz;
        }
        else
        {
            true_color = simplex_colors[3].xyz;
        }
    }

    float light_direct = 0.7 * clamp(-dot(LIGHT_DIR, v_normal), 0.0, 1.0);
    float light_ambient = 0.3;

    vec3 light = (shade_amount * (light_direct + light_ambient) * true_color) + (1.0 - shade_amount) * true_color;

    gl_FragColor = vec4(light, transparency);
}
`;


export const VERT_SHADER: string = `
attribute vec4 vertex_pos;
attribute vec3 vertex_normal;
attribute vec4 simplex_pos;

varying highp vec3 v_normal;
varying highp vec3 v_pos;
varying highp vec4 v_simplex_pos;

uniform mat4 position_matrix;
uniform mat4 view_matrix;


void main() {
    gl_Position = view_matrix * position_matrix * vertex_pos;
    v_normal = (position_matrix * vec4(vertex_normal,1)).xyz;
    v_pos = vertex_pos.xyz;
    v_simplex_pos = simplex_pos;
}
`;
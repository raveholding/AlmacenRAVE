# Prompts de la plataforma Sistema VB v4 (Vincular Business)

| Archivo | Qué es | Se usa |
|---|---|---|
| `0-inventario-funcional-y-paridad.md` | Todo lo que ya existe en los sistemas de VB (núcleo, raveV3, Kini, seguridad física, estudio contable, plataforma SaaS). Checklist de paridad. | Siempre |
| `S-seguridad-obligatoria.md` | Anexo de seguridad (principio rector, ASVS, RLS, cifrado, Ley 25.326, IA, cámaras, CI). | Siempre |
| `1-plataforma-sistema-vb-demo.md` | Plataforma base + demo genérica Vincular Business + sitio web. | Base de todo |
| `2-raveV3-empresas.md` | Edición Empresas (demo raveV3). | Con 0 + S + 1 |
| `3-cliente-almacenrave.md` | Perfil y migración del cliente Almacén RAVE. | Con 0 + S + 1 |
| `4-mayorista-generico.md` | Edición Mayorista genérica (demo base: Kini Distribuidora). | Con 0 + S + 1 |

Orden de prioridad si algo se contradice: principio rector (S·0) → seguridad (S) → prompt de la edición → prompt 1 → inventario → `fuente/SISTEMA_VB_26F.md`.
Trabajar **una fase por sesión**, empezando por la Fase 0 (relevamiento), que no programa nada.

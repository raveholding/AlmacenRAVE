-- =====================================================================
-- SISTEMA RAVE · 90 · Volver a probar desde cero (SÓLO PARA PRUEBAS)
--
-- Borra lo que los equipos subieron a la nube de TODOS los comercios:
-- registros (productos, ventas, clientes…), llaves, menús publicados, altas
-- del Club y comprobantes de ARCA que NO tengan CAE. Las cuentas, los comercios,
-- los equipos y la configuración de ARCA quedan.
--
-- Los comprobantes con CAE (aprobados) NO se borran nunca: por diseño son
-- inmutables. Si probaste contra producción real, no uses este script.
-- NO correr cuando el sistema ya está en uso real: no se puede deshacer.
-- =====================================================================
delete from public.registros;
delete from public.menus_historial;
delete from public.menus;
delete from public.club_altas;
delete from public.menu_eventos;
delete from public.llaves;
delete from public.llaves_recuperacion;
delete from public.arca_locks;
delete from public.arca_comprobantes where estado <> 'aprobado';

select (select count(*) from public.registros)  as registros,
       (select count(*) from public.menus)      as menus,
       (select count(*) from public.llaves)     as llaves,
       (select count(*) from public.arca_comprobantes where estado = 'aprobado') as con_cae_que_se_conservan;

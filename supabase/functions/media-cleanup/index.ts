import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async request=>{
  if(request.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});
  const expected=Deno.env.get('MEDIA_CLEANUP_SECRET')||'';
  if(!expected||request.headers.get('x-cleanup-secret')!==expected)return Response.json({error:'Unauthorized.'},{status:401});
  try{
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const {data:discovered,error:discoveryError}=await admin.rpc('discover_orphan_media_cleanup');if(discoveryError)throw discoveryError;
    const {data:items,error}=await admin.rpc('due_unused_media_cleanup',{batch_size:200});if(error)throw error;
    let deleted=0,failed=0;
    for(const item of items||[]){
      const {error:removeError}=await admin.storage.from(item.bucket_id).remove([item.object_path]);
      if(removeError){failed++;console.error(`Could not delete ${item.bucket_id}/${item.object_path}: ${removeError.message}`);continue;}
      const {error:completeError}=await admin.rpc('complete_media_cleanup',{cleanup_id:item.id});
      if(completeError){failed++;console.error(`Could not complete queue item ${item.id}: ${completeError.message}`);continue;}
      deleted++;
    }
    return Response.json({discovered,checked:(items||[]).length,deleted,failed});
  }catch(error){return Response.json({error:error.message||'Media cleanup failed.'},{status:500});}
});

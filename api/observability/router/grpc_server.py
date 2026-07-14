import logging
import asyncio
from grpc import aio
from proto import insight_pb2, insight_pb2_grpc
from service.insight_generator import generate_insight

logger = logging.getLogger(__name__)


class InsightServicer(insight_pb2_grpc.InsightServiceServicer):
  
    async def GetMonitorInsight(self, request, context):
        try:
            monitor_id = request.monitor_id
            logger.info(f"gRPC GetMonitorInsight called for monitor_id={monitor_id}")

            insight = generate_insight(monitor_id)
            
            if insight is None:
                logger.warning(f"No insight found for monitor_id={monitor_id}")
                await context.abort(
                    aio.StatusCode.NOT_FOUND,
                    f"Insight not found for monitor {monitor_id}"
                )
            
            proto_insight = insight_pb2.MonitorInsight(
                monitor_id=insight.monitor_id,
                monitor_name=insight.monitor_name,
                risk_score=insight.risk_score,
                anomaly_detected=insight.anomaly_detected,
                severity=insight.severity,
                summary=insight.summary,
                recommended_action=insight.recommended_action,
                human_readable=insight.human_readable or "",
                generated_at=insight.generated_at,
            )
            
            return insight_pb2.GetMonitorInsightResponse(insight=proto_insight)
            
        except Exception as e:
            logger.error(f"Error in GetMonitorInsight: {str(e)}", exc_info=True)
            await context.abort(aio.StatusCode.INTERNAL, f"Internal error: {str(e)}")


async def serve(host: str = "0.0.0.0", port: int = 50051):
    server = aio.server()
    insight_pb2_grpc.add_InsightServiceServicer_to_server(
        InsightServicer(), server
    )
    
    listen_addr = f"{host}:{port}"
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Starting gRPC server on {listen_addr}")
    await server.start()
    await server.wait_for_termination()


def start_grpc_server_sync(host: str = "0.0.0.0", port: int = 50051):
    
    asyncio.run(serve(host, port))

import json
import traceback
from error_classification import CleanerError

class RPCDispatcher:
    def __init__(self):
        self.methods = {}

    def register(self, name):
        """Registers a method handler inside the RPC dispatch loop as a decorator."""
        def decorator(handler):
            self.methods[name] = handler
            return handler
        return decorator

    def handle_message(self, raw_line):
        """
        Parses a single-line newline-delimited JSON-RPC 2.0 packet
        and routes it to the designated method handler.
        """
        request_id = None
        try:
            raw_line = raw_line.strip()
            if not raw_line:
                return None
            
            try:
                request = json.loads(raw_line)
            except json.JSONDecodeError:
                return self._error_response(-32700, "Parse error: Invalid JSON structure.", request_id)

            if not isinstance(request, dict):
                return self._error_response(-32600, "Invalid Request: Request must be a JSON object.", request_id)

            # Extract request parameters
            jsonrpc = request.get("jsonrpc")
            method = request.get("method")
            params = request.get("params", {})
            request_id = request.get("id")

            # Validate basic JSON-RPC structure
            if jsonrpc != "2.0":
                return self._error_response(-32600, "Invalid Request: Only JSON-RPC 2.0 protocol is supported.", request_id)
            if not method:
                return self._error_response(-32600, "Invalid Request: Missing 'method' field.", request_id)

            # Route execution
            if method not in self.methods:
                return self._error_response(-32601, f"Method not found: '{method}' is unregistered.", request_id)

            try:
                # Dispatch handler
                result = self.methods[method](params)
                
                # Check for notifications (no ID)
                if request_id is None:
                    return None
                
                return {
                    "jsonrpc": "2.0",
                    "result": result,
                    "id": request_id
                }
            except CleanerError as ce:
                # Handle our high-level categorized errors cleanly
                return ce.to_rpc_format(request_id)
            except Exception as e:
                # Catch general unhandled exceptions safely, logging internally but masking details from UI
                tb = "".join(traceback.format_exception(None, e, e.__traceback__))
                # Map to generic server error
                return {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32603,
                        "message": "Internal engine error occurred during operation.",
                        "data": {
                            "type": "UnhandledInternalException",
                            "message": str(e)
                        }
                    },
                    "id": request_id
                }

        except Exception as system_critical:
            # Absolute fallback for system failures
            return self._error_response(-32603, f"Critical RPC subsystem failure: {str(system_critical)}", request_id)

    def _error_response(self, code, message, request_id=None):
        return {
            "jsonrpc": "2.0",
            "error": {
                "code": code,
                "message": message
            },
            "id": request_id
        }

    @staticmethod
    def create_notification(method, params=None):
        """Creates an outbound JSON-RPC 2.0 notification frame (no request ID)."""
        return {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {}
        }

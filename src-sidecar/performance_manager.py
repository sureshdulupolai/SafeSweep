import os
import sys
import time
import ctypes
from ctypes import wintypes
from utils.logger import logger

# Structure for Windows Power Status Queries
class SYSTEM_POWER_STATUS(ctypes.Structure):
    _fields_ = [
        ("ACLineStatus", ctypes.c_byte),
        ("BatteryFlag", ctypes.c_byte),
        ("BatteryLifePercent", ctypes.c_byte),
        ("SystemStatus", ctypes.c_byte),  # 1 indicates Battery Saver is active on Win10+
        ("BatteryLifeTime", wintypes.DWORD),
        ("BatteryFullLifeTime", wintypes.DWORD)
    ]

# Structure for FILETIME queries
class FILETIME(ctypes.Structure):
    _fields_ = [
        ("dwLowDateTime", wintypes.DWORD),
        ("dwHighDateTime", wintypes.DWORD)
    ]

class PerformanceManager:
    def __init__(self):
        self.max_threads = os.cpu_count() or 4
        self.prev_idle = 0
        self.prev_kernel = 0
        self.prev_user = 0
        self._initialize_cpu_tracking()

    def _initialize_cpu_tracking(self):
        """Pre-seeds system time values to prepare for delta-based CPU calculation."""
        self.prev_idle, self.prev_kernel, self.prev_user = self._get_system_times()

    def _get_system_times(self):
        """Queries Win32 system times using ctypes for zero-dependency resource mapping."""
        idle = FILETIME()
        kernel = FILETIME()
        user = FILETIME()
        
        success = ctypes.windll.kernel32.GetSystemTimes(
            ctypes.byref(idle),
            ctypes.byref(kernel),
            ctypes.byref(user)
        )
        
        if not success:
            return 0, 0, 0
            
        def to_int(ft):
            return (ft.dwHighDateTime << 32) + ft.dwLowDateTime
            
        return to_int(idle), to_int(kernel), to_int(user)

    def calculate_cpu_load(self):
        """
        Calculates instantaneous global CPU utilization via delta difference of system times.
        Does not require psutil or other compiled external components.
        """
        idle1, kernel1, user1 = self.prev_idle, self.prev_kernel, self.prev_user
        idle2, kernel2, user2 = self._get_system_times()
        
        # Save current measurements for next step
        self.prev_idle, self.prev_kernel, self.prev_user = idle2, kernel2, user2
        
        idle_diff = idle2 - idle1
        kernel_diff = kernel2 - kernel1
        user_diff = user2 - user1
        
        total_sys = kernel_diff + user_diff
        
        if total_sys == 0:
            return 0.0
            
        # Kernel time includes idle time on Windows, so we subtract idle from it
        # to calculate active execution cycles
        active_sys = total_sys - idle_diff
        if active_sys < 0:
            active_sys = 0
            
        cpu_load = (active_sys / total_sys) * 100.0
        return min(max(cpu_load, 0.0), 100.0)

    def is_battery_saver_active(self):
        """Queries Windows System Power Status to check if battery saver is enabled."""
        status = SYSTEM_POWER_STATUS()
        success = ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(status))
        if not success:
            return False
            
        # SystemStatus = 1 indicates battery saving mode is enabled on Windows 10+
        return status.SystemStatus == 1 or status.ACLineStatus == 0

    def evaluate_throttling(self):
        """
        Audits active system indicators and computes the recommended thread allocation
        and sleep backoff interval (in seconds) to keep the UI fluid.
        
        Returns:
            recommended_threads: int
            sleep_delay: float (seconds)
        """
        cpu_load = self.calculate_cpu_load()
        battery_saver = self.is_battery_saver_active()
        
        recommended_threads = self.max_threads
        sleep_delay = 0.0
        
        # Throttling levels
        if cpu_load > 85.0:
            # CPU Spike backoff: Restrict thread execution allocation
            recommended_threads = max(1, int(self.max_threads * 0.25))
            sleep_delay = 0.002  # 2ms pause per recursive sweep iteration
        elif cpu_load > 60.0:
            # Balanced backoff: Moderate thread allocations
            recommended_threads = max(2, int(self.max_threads * 0.5))
            sleep_delay = 0.0005  # 0.5ms pause per loop
            
        return recommended_threads, sleep_delay

# Global performance manager instance
performance_manager = PerformanceManager()

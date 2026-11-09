package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/openclaw/clawhub/backend/internal/middleware"
	"github.com/openclaw/clawhub/backend/internal/service"
	"github.com/sirupsen/logrus"
)

func SyncSkillDescriptionsHandler(skillService *service.SkillService, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := middleware.GetCurrentUser(c)
		if !authService.HasManagementAccess(actor) || !authService.IsSuperuser(actor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "superuser required"})
			return
		}

		result, err := skillService.SyncMissingSkillDescriptions(c.Request.Context())
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"actor_id":     actor.ID,
				"actor_handle": actor.Handle,
				"endpoint":     "POST /api/v1/admin/maintenance/skill-descriptions/sync",
			}).Warn("failed to sync missing skill descriptions")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync skill descriptions"})
			return
		}

		logrus.WithFields(logrus.Fields{
			"actor_id":     actor.ID,
			"actor_handle": actor.Handle,
			"endpoint":     "POST /api/v1/admin/maintenance/skill-descriptions/sync",
			"running":      result.Running,
			"locked":       result.Locked,
			"scanned":      result.Scanned,
			"updated":      result.Updated,
			"skipped":      result.Skipped,
			"failed":       result.Failed,
		}).Info("sync missing skill descriptions requested")

		c.JSON(http.StatusOK, result)
	}
}
